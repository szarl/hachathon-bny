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

import pdfplumber

MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_IMAGE_BYTES = 10 * 1024 * 1024


@dataclass
class ImageBudget:
    total_bytes: int = 0


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


def extract_page_images(page, page_number, budget):
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

        try:
            stream = image.get("stream")
            raw = stream.get_data() if stream else b""
            if raw.startswith(b"\xff\xd8\xff"):
                image_payload["filename"] = f"{filename_base}.jpg"
                image_payload["mimeType"] = "image/jpeg"
            elif raw.startswith(b"\x89PNG\r\n\x1a\n"):
                image_payload["filename"] = f"{filename_base}.png"
                image_payload["mimeType"] = "image/png"
            else:
                bbox = (
                    image["x0"],
                    image["top"],
                    image["x1"],
                    image["bottom"],
                )
                cropped = page.crop(bbox)
                rendered = cropped.to_image(resolution=144).original
                buffer = BytesIO()
                rendered.save(buffer, format="PNG")
                raw = buffer.getvalue()
        except Exception as exc:
            image_payload.update(
                {
                    "skipped": True,
                    "warning": f"Image extraction failed: {exc}",
                }
            )
            images.append(image_payload)
            continue

        if len(raw) > MAX_IMAGE_BYTES:
            image_payload.update(
                {
                    "skipped": True,
                    "warning": f"Image exceeds {MAX_IMAGE_BYTES} byte per-image limit",
                }
            )
        elif budget.total_bytes + len(raw) > MAX_TOTAL_IMAGE_BYTES:
            image_payload.update(
                {
                    "skipped": True,
                    "warning": f"Image exceeds {MAX_TOTAL_IMAGE_BYTES} byte total PDF image limit",
                }
            )
        else:
            budget.total_bytes += len(raw)
            image_payload["dataBase64"] = base64.b64encode(raw).decode("ascii")

        images.append(image_payload)

    return images


def extract_pdf(path):
    extracted_pages = []
    image_budget = ImageBudget()

    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            font_sizes = sorted(
                {
                    round(float(char["size"]), 2)
                    for char in page.chars
                    if char.get("size")
                }
            )
            extracted_pages.append(
                {
                    "pageNumber": index,
                    "text": page.extract_text() or "",
                    "fontSizes": font_sizes,
                    "source": "pdfplumber",
                    "images": extract_page_images(page, index, image_budget),
                }
            )

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
    server = HTTPServer(("127.0.0.1", port), handler)
    print(f"Python extract API listening on http://127.0.0.1:{port}/api/extract")
    server.serve_forever()
