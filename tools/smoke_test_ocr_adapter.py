import argparse
import json
import urllib.request


def main():
    parser = argparse.ArgumentParser(description="Smoke test PaddleOCR adapter")
    parser.add_argument("--adapter-url", default="http://127.0.0.1:8787/ocr")
    parser.add_argument("--image-url", required=True)
    parser.add_argument("--token", default="")
    args = parser.parse_args()

    payload = json.dumps({
        "fileID": "local-smoke-test",
        "tempFileURL": args.image_url,
    }).encode("utf-8")

    request = urllib.request.Request(
        args.adapter_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            **(
                {"Authorization": f"Bearer {args.token}"}
                if args.token else {}
            ),
        },
        method="POST",
    )

    with urllib.request.urlopen(request) as response:
        print(response.read().decode("utf-8"))


if __name__ == "__main__":
    main()
