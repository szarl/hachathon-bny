import base64
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz
from PIL import Image

from api import extract


def _solid_png(w, h):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


def _tiny_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (40, 20), (200, 100, 50)).save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def make_simple_pdf(text):
    stream = f"BT /F1 18 Tf 72 720 Td ({text}) Tj ET".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]

    chunks = [b"%PDF-1.4\n"]
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(sum(len(chunk) for chunk in chunks))
        chunks.append(f"{index} 0 obj\n".encode("ascii") + obj + b"\nendobj\n")

    xref_offset = sum(len(chunk) for chunk in chunks)
    chunks.append(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    chunks.append(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        chunks.append(f"{offset:010d} 00000 n \n".encode("ascii"))
    chunks.append(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return b"".join(chunks)


class FakeOriginalImage:
    def __init__(self, payload):
        self.payload = payload
        self.size = (24, 12)

    def save(self, buffer, format):
        self.format = format
        buffer.write(self.payload)


class FakePageImage:
    def __init__(self, payload):
        self.original = FakeOriginalImage(payload)


class FakeCroppedPage:
    def __init__(self, payload):
        self.payload = payload

    def to_image(self, resolution):
        self.resolution = resolution
        return FakePageImage(self.payload)


class FakeImagePage:
    def __init__(self, payloads):
        self.images = [
            {"x0": 0, "top": 0, "x1": 24, "bottom": 12, "width": 24, "height": 12}
            for _ in payloads
        ]
        self.payloads = list(payloads)

    def crop(self, bbox):
        return FakeCroppedPage(self.payloads.pop(0))


class FakeStream:
    def __init__(self, payload):
        self.payload = payload

    def get_data(self):
        return self.payload


class FakeEmbeddedImagePage:
    images = [
        {
            "stream": FakeStream(_tiny_jpeg()),
            "width": 40,
            "height": 20,
        }
    ]

    def crop(self, bbox):
        raise AssertionError("embedded image streams should not be rendered")


def make_pdf_with_uri_link():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Click example link", fontsize=14)
    rect = fitz.Rect(72, 85, 220, 118)
    page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": "https://example.com/foo"})
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


class ExtractTests(unittest.TestCase):
    def test_pymupdf_version_reported(self):
        ver = extract._pymupdf_version()
        self.assertIsInstance(ver, str)
        self.assertTrue(len(ver) > 0)

    def test_finalize_extracted_png_respects_max_width(self):
        buf = io.BytesIO()
        Image.new("RGB", (2000, 500), (128, 0, 0)).save(buf, format="PNG")
        im = Image.open(io.BytesIO(buf.getvalue()))
        try:
            out = extract.finalize_extracted_png(im, max_width=1000, max_bytes=extract.MAX_IMAGE_BYTES)
        finally:
            im.close()
        self.assertIsNotNone(out)
        png_bytes, w, h = out
        self.assertLessEqual(w, 1000)
        self.assertEqual(w, 1000)
        self.assertEqual(h, 250)
        self.assertLessEqual(len(png_bytes), extract.MAX_IMAGE_BYTES)
        self.assertTrue(png_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_extract_pdf_returns_structured_pages_with_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            pdf_path = Path(tmpdir) / "sample.pdf"
            pdf_path.write_bytes(make_simple_pdf("Hello DITA"))

            pages = extract.extract_pdf(str(pdf_path))

        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["pageNumber"], 1)
        self.assertIn("Hello DITA", pages[0]["text"])
        self.assertEqual(pages[0]["source"], "pdfplumber")
        self.assertTrue(any(size > 0 for size in pages[0]["fontSizes"]))
        self.assertEqual(pages[0]["images"], [])
        self.assertNotIn("tables", pages[0])
        self.assertNotIn("hyperlinks", pages[0])

    def test_extract_pdf_includes_hyperlinks_from_pymupdf(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            pdf_path = Path(tmpdir) / "linked.pdf"
            pdf_path.write_bytes(make_pdf_with_uri_link())

            pages = extract.extract_pdf(str(pdf_path))

        self.assertEqual(len(pages), 1)
        links = pages[0].get("hyperlinks") or []
        self.assertTrue(len(links) >= 1)
        uris = [link.get("uri") for link in links if link.get("uri")]
        self.assertTrue(any("example.com/foo" in (u or "") for u in uris))

    def test_extract_page_images_second_skipped_when_total_budget_exceeded(self):
        fake_png = _solid_png(8, 8)
        page = FakeImagePage([fake_png, fake_png])
        state = extract.ImageBudget()
        state.total_bytes = extract.MAX_TOTAL_IMAGE_BYTES - 50_000

        with patch.object(
            extract,
            "finalize_extracted_png",
            side_effect=[
                (b"x" * 40_000, 10, 10),
                (b"y" * 40_000, 10, 10),
            ],
        ):
            images = extract.extract_page_images(page, 3, state)

        self.assertEqual(len(images), 2)
        self.assertFalse(images[0].get("skipped", False))
        self.assertIn("dataBase64", images[0])
        self.assertTrue(images[1]["skipped"])
        self.assertNotIn("dataBase64", images[1])
        self.assertIn("total PDF image limit", images[1]["warning"])

    def test_extract_page_images_uses_embedded_jpeg_streams_as_png(self):
        state = extract.ImageBudget()

        images = extract.extract_page_images(FakeEmbeddedImagePage(), 4, state)

        self.assertEqual(len(images), 1)
        self.assertEqual(images[0]["filename"], "page_04_image_01.png")
        self.assertEqual(images[0]["mimeType"], "image/png")
        self.assertIn("dataBase64", images[0])
        raw = base64.b64decode(images[0]["dataBase64"])
        self.assertTrue(raw.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertLessEqual(len(raw), extract.MAX_IMAGE_BYTES)


if __name__ == "__main__":
    unittest.main()
