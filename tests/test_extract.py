import io
import json
import tempfile
import unittest
from pathlib import Path

from api import extract


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
            "stream": FakeStream(b"\xff\xd8\xff\xe0jpeg-data"),
            "width": 40,
            "height": 20,
        }
    ]

    def crop(self, bbox):
        raise AssertionError("embedded image streams should not be rendered")


class ExtractTests(unittest.TestCase):
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

    def test_extract_page_images_caps_base64_payloads(self):
        small_payload = b"a" * 32
        large_payload = b"b" * (extract.MAX_IMAGE_BYTES + 1)
        page = FakeImagePage([small_payload, large_payload])
        state = extract.ImageBudget()

        images = extract.extract_page_images(page, 3, state)

        self.assertEqual(len(images), 2)
        self.assertEqual(images[0]["filename"], "page_03_image_01.png")
        self.assertEqual(images[0]["pageNumber"], 3)
        self.assertEqual(images[0]["mimeType"], "image/png")
        self.assertIn("dataBase64", images[0])
        self.assertFalse(images[0].get("skipped", False))
        self.assertEqual(images[1]["filename"], "page_03_image_02.png")
        self.assertTrue(images[1]["skipped"])
        self.assertNotIn("dataBase64", images[1])
        self.assertIn("exceeds", images[1]["warning"])

    def test_extract_page_images_uses_embedded_jpeg_streams(self):
        state = extract.ImageBudget()

        images = extract.extract_page_images(FakeEmbeddedImagePage(), 4, state)

        self.assertEqual(len(images), 1)
        self.assertEqual(images[0]["filename"], "page_04_image_01.jpg")
        self.assertEqual(images[0]["mimeType"], "image/jpeg")
        self.assertEqual(images[0]["width"], 40)
        self.assertEqual(images[0]["height"], 20)
        self.assertIn("dataBase64", images[0])


if __name__ == "__main__":
    unittest.main()
