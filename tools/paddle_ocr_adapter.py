import json
import os
import tempfile
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer


PORT = int(os.environ.get("PORT", "8787"))
OCR_ADAPTER_TOKEN = os.environ.get("OCR_ADAPTER_TOKEN", "")
PADDLE_OCR_LANG = os.environ.get("PADDLE_OCR_LANG", "ch")

_OCR_INSTANCE = None


def extract_text_from_prediction(prediction):
    lines = []

    if isinstance(prediction, list):
        for item in prediction:
            if isinstance(item, dict):
                rec_texts = item.get("rec_texts") or item.get("rec_text")
                if isinstance(rec_texts, list):
                    lines.extend([str(text).strip() for text in rec_texts if str(text).strip()])
                elif isinstance(rec_texts, str) and rec_texts.strip():
                    lines.append(rec_texts.strip())
            elif isinstance(item, list):
                for row in item:
                    if (
                        isinstance(row, list)
                        and len(row) >= 2
                        and isinstance(row[1], tuple)
                        and row[1]
                    ):
                        text = str(row[1][0]).strip()
                        if text:
                            lines.append(text)

    normalized_lines = [line for line in lines if line]
    return "\n".join(normalized_lines), normalized_lines


def get_ocr_instance():
    global _OCR_INSTANCE

    if _OCR_INSTANCE is not None:
        return _OCR_INSTANCE

    from paddleocr import PaddleOCR

    _OCR_INSTANCE = PaddleOCR(lang=PADDLE_OCR_LANG)
    return _OCR_INSTANCE


def run_paddle_ocr(image_path):
    ocr = get_ocr_instance()

    if hasattr(ocr, "predict"):
        prediction = ocr.predict(image_path)
    else:
        prediction = ocr.ocr(image_path, cls=True)

    return extract_text_from_prediction(prediction)


def download_image(temp_file_url):
    with urllib.request.urlopen(temp_file_url) as response:
        suffix = ".png"
        content_type = response.headers.get("Content-Type", "")
        if "jpeg" in content_type or "jpg" in content_type:
            suffix = ".jpg"
        elif "webp" in content_type:
            suffix = ".webp"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(response.read())
            return temp_file.name


class PaddleOcrHandler(BaseHTTPRequestHandler):
    def send_json(self, status_code, payload):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_POST(self):
        if self.path != "/ocr":
            self.send_json(404, {"error": "Not Found"})
            return

        if OCR_ADAPTER_TOKEN:
            expected = f"Bearer {OCR_ADAPTER_TOKEN}"
            if self.headers.get("Authorization", "") != expected:
                self.send_json(401, {"error": "Unauthorized"})
                return

        temp_path = ""
        try:
            body = self.read_json_body()
            temp_file_url = body.get("tempFileURL", "")
            if not temp_file_url:
                self.send_json(200, {"text": "", "lines": []})
                return

            temp_path = download_image(temp_file_url)
            text, lines = run_paddle_ocr(temp_path)
            self.send_json(200, {"text": text, "lines": lines})
        except Exception as error:  # pragma: no cover - runtime safeguard
            self.send_json(500, {
                "error": "OCR adapter failed",
                "detail": str(error),
            })
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)


def main():
    server = HTTPServer(("0.0.0.0", PORT), PaddleOcrHandler)
    print(f"PaddleOCR adapter listening on http://0.0.0.0:{PORT}/ocr")
    server.serve_forever()


if __name__ == "__main__":
    main()
