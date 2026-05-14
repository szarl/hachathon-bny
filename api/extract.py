import base64
import json
import os
import tempfile
from dataclasses import dataclass
from email import policy
from email.parser import BytesParser
from io import BytesIO
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer

import fitz  # PyMuPDF
import pdfplumber
from PIL import Image

# Extracted images: always PNG, max width 1000px, max encoded size 200 KB each.
MAX_IMAGE_BYTES = 200 * 1024
EXTRACTED_IMAGE_MAX_WIDTH = 1000
MAX_TOTAL_IMAGE_BYTES = 10 * 1024 * 1024

MAX_LINKS_PER_PAGE = 40
MAX_URI_LENGTH = 512
MAX_ANCHOR_LENGTH = 200
MAX_CONTEXT_SNIPPET = 200
MAX_TABLES_PER_PAGE = 10
MAX_TABLE_ROWS = 40
MAX_TABLE_COLS = 20


def _pymupdf_version():
    return getattr(fitz, "__version__", None) or (
        ".".join(str(x) for x in fitz.version[:3]) if hasattr(fitz, "version") else "unknown"
    )


@dataclass
class ImageBudget:
    total_bytes: int = 0


def finalize_extracted_png(
    pil_image: Image.Image,
    max_width: int = EXTRACTED_IMAGE_MAX_WIDTH,
    max_bytes: int = MAX_IMAGE_BYTES,
) -> tuple[bytes, int, int] | None:
    """
    Normalize to PNG: max width `max_width` (aspect preserved), then shrink until
    encoded size <= `max_bytes`. Returns (png_bytes, width, height) or None if unusable.
    """
    im = pil_image
    try:
        if im.mode == "P":
            if "transparency" in im.info:
                im = im.convert("RGBA")
            else:
                im = im.convert("RGB")
        elif im.mode in ("RGBA", "RGB", "L"):
            if im.mode == "L":
                im = im.convert("RGB")
        elif im.mode == "LA":
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")

        w, h = im.size
        if w <= 0 or h <= 0:
            return None

        if w > max_width:
            nh = max(1, int(round(h * (max_width / float(w)))))
            im = im.resize((max_width, nh), Image.Resampling.LANCZOS)

        def encode_png(img: Image.Image) -> bytes:
            buf = BytesIO()
            img.save(buf, format="PNG", optimize=True, compress_level=9)
            return buf.getvalue()

        raw = encode_png(im)
        iterations = 0
        while len(raw) > max_bytes and iterations < 40:
            iterations += 1
            w, h = im.size
            if min(w, h) <= 16:
                return None
            ratio = len(raw) / float(max_bytes)
            scale = min(0.9, (1.0 / ratio) ** 0.55)
            nw = max(16, int(w * scale))
            nh = max(1, int(round(h * (nw / float(w)))))
            im = im.resize((nw, nh), Image.Resampling.LANCZOS)
            raw = encode_png(im)

        if len(raw) > max_bytes:
            return None
        return raw, im.size[0], im.size[1]
    except Exception:
        return None


def _send_json(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_multipart_file(handler):
    content_type = handler.headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type:
        return None, None

    length = int(handler.headers.get("Content-Length", "0"))
    body = handler.rfile.read(length)
    message = BytesParser(policy=policy.default).parsebytes(
        b"Content-Type: "
        + content_type.encode("utf-8")
        + b"\r\nMIME-Version: 1.0\r\n\r\n"
        + body
    )

    for part in message.iter_parts():
        filename = part.get_filename()
        if filename:
            return filename, part.get_payload(decode=True)

    return None, None


def clean_table_cell(cell):
    if cell is None:
        return ""
    return str(cell).replace("\n", " ").strip()


def extract_tables_structured(page_plumber):
    try:
        raw_tables = page_plumber.extract_tables() or []
    except Exception:
        return []

    clean_tables = []
    for table in raw_tables[:MAX_TABLES_PER_PAGE]:
        if not table:
            continue
        formatted = []
        for row in table[:MAX_TABLE_ROWS]:
            cells = [clean_table_cell(c) for c in row[:MAX_TABLE_COLS]]
            if any(cells):
                formatted.append(cells)
        if formatted:
            clean_tables.append(formatted)
    return clean_tables


def extract_hyperlinks(page_fitz):
    links = page_fitz.get_links() or []

    def anchor_weight(link):
        rect = link.get("from")
        if rect is None:
            return 0
        try:
            return len(page_fitz.get_text("text", clip=rect).strip())
        except Exception:
            return 0

    sorted_links = sorted(links, key=anchor_weight, reverse=True)
    out = []
    for link in sorted_links[:MAX_LINKS_PER_PAGE]:
        rect = link.get("from")
        if rect is None:
            continue
        try:
            anchor = page_fitz.get_text("text", clip=rect).strip()
        except Exception:
            anchor = ""
        anchor = anchor[:MAX_ANCHOR_LENGTH]
        entry = {"anchorText": anchor}
        uri = link.get("uri")
        if uri:
            entry["uri"] = str(uri)[:MAX_URI_LENGTH]
        elif link.get("kind") == fitz.LINK_GOTO:
            target = link.get("page")
            if target is not None:
                entry["targetPage"] = int(target) + 1
        if entry.get("uri") or entry.get("targetPage") is not None or anchor:
            out.append(entry)
    return out


def extract_page_images(page, page_number, budget, page_fitz=None):
    images = []

    for index, image in enumerate(page.images, start=1):
        filename_base = f"page_{page_number:02d}_image_{index:02d}"
        image_payload = {
            "filename": f"{filename_base}.png",
            "pageNumber": page_number,
            "mimeType": "image/png",
            "width": int(image.get("width") or 0) or None,
            "height": int(image.get("height") or 0) or None,
        }

        if page_fitz is not None:
            try:
                r = fitz.Rect(
                    float(image["x0"]),
                    float(image["top"]),
                    float(image["x1"]),
                    float(image["bottom"]),
                )
                ctx = (r + (-50, -50, 50, 50)) & page_fitz.rect
                snippet = (
                    page_fitz.get_text("text", clip=ctx).replace("\n", " ").strip()
                )
                if snippet:
                    image_payload["caption"] = snippet[:MAX_CONTEXT_SNIPPET]
            except Exception:
                pass

        try:
            stream = image.get("stream")
            raw_stream = stream.get_data() if stream else b""
            pil = None
            close_pil = False
            if raw_stream.startswith(b"\xff\xd8\xff"):
                pil = Image.open(BytesIO(raw_stream))
                close_pil = True
            elif raw_stream.startswith(b"\x89PNG\r\n\x1a\n"):
                pil = Image.open(BytesIO(raw_stream))
                close_pil = True
            else:
                bbox = (
                    image["x0"],
                    image["top"],
                    image["x1"],
                    image["bottom"],
                )
                cropped = page.crop(bbox)
                pil = cropped.to_image(resolution=144).original

            try:
                finalized = finalize_extracted_png(pil)
            finally:
                if close_pil and pil is not None:
                    pil.close()

            if finalized is None:
                image_payload.update(
                    {
                        "skipped": True,
                        "warning": "Image could not be normalized to PNG within 200 KB (and minimum size) limits.",
                    }
                )
                images.append(image_payload)
                continue

            png_bytes, out_w, out_h = finalized
            image_payload["width"] = out_w
            image_payload["height"] = out_h
        except Exception as exc:
            image_payload.update(
                {
                    "skipped": True,
                    "warning": f"Image extraction failed: {exc}",
                }
            )
            images.append(image_payload)
            continue

        if budget.total_bytes + len(png_bytes) > MAX_TOTAL_IMAGE_BYTES:
            image_payload.update(
                {
                    "skipped": True,
                    "warning": f"Image exceeds {MAX_TOTAL_IMAGE_BYTES} byte total PDF image limit",
                }
            )
        else:
            budget.total_bytes += len(png_bytes)
            image_payload["dataBase64"] = base64.b64encode(png_bytes).decode("ascii")

        images.append(image_payload)

    return images


def extract_pdf(path):
    extracted_pages = []
    image_budget = ImageBudget()

    doc_fitz = fitz.open(path)
    try:
        with pdfplumber.open(path) as pdf:
            if len(doc_fitz) != len(pdf.pages):
                raise ValueError(
                    "PDF page count mismatch between PyMuPDF and pdfplumber."
                )
            for index, page in enumerate(pdf.pages, start=1):
                page_fitz = doc_fitz[index - 1]
                font_sizes = sorted(
                    {
                        round(float(char["size"]), 2)
                        for char in page.chars
                        if char.get("size")
                    }
                )
                tables = extract_tables_structured(page)
                hyperlinks = extract_hyperlinks(page_fitz)

                row = {
                    "pageNumber": index,
                    "text": page.extract_text() or "",
                    "fontSizes": font_sizes,
                    "source": "pdfplumber",
                    "images": extract_page_images(
                        page, index, image_budget, page_fitz=page_fitz
                    ),
                }
                if tables:
                    row["tables"] = tables
                if hyperlinks:
                    row["hyperlinks"] = hyperlinks
                extracted_pages.append(row)
    finally:
        doc_fitz.close()

    return extracted_pages


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        _send_json(
            self,
            200,
            {
                "ok": True,
                "runtime": "python",
                "pdfplumberVersion": pdfplumber.__version__,
                "pymupdfVersion": _pymupdf_version(),
            },
        )

    def do_POST(self):
        filename, pdf_bytes = _read_multipart_file(self)
        if not filename or not pdf_bytes or not filename.lower().endswith(".pdf"):
            _send_json(self, 400, {"error": "No PDF file provided"})
            return

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name

            _send_json(self, 200, {"extractedPages": extract_pdf(tmp_path)})
        except Exception as exc:
            _send_json(self, 500, {"error": str(exc)})
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8001"))
    host = os.environ.get("BIND_ADDRESS", "127.0.0.1")
    server = HTTPServer((host, port), handler)
    print(
        f"Python extract API listening on http://{host}:{port}/api/extract",
        flush=True,
    )
    server.serve_forever()
