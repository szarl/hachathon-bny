import json
import os
import tempfile
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer

import pdfplumber


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

            extracted_pages = []
            with pdfplumber.open(tmp_path) as pdf:
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
                        }
                    )

            _send_json(self, 200, {"extractedPages": extracted_pages})
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
