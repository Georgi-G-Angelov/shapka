"""Serve the design prototype without caching editable source files."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1] / "project"


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # Edits can share a one-second mtime; a 304 would reuse the old script.
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8840)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(PROJECT))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Preview: http://127.0.0.1:{args.port}/Shapka.html (no cache)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
