"""Local HTTP server: `static/` at site root, `tools/` under `/tools/`."""

from __future__ import annotations

import argparse
import errno
import http.server
import os
import socketserver
import urllib.parse
import webbrowser

# Repository root (parent of this package)
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_ROOT = os.path.join(_REPO_ROOT, "static")
TOOLS_ROOT = os.path.join(_REPO_ROOT, "tools")

PORT = 8000
MAX_PORTS_TO_TRY = 20
_ADDR_IN_USE = {errno.EADDRINUSE}
if hasattr(errno, "WSAEADDRINUSE"):
    _ADDR_IN_USE.add(errno.WSAEADDRINUSE)

GENERIC_EDITOR_PATH = "/tools/generic-template-editor/"


def _make_handler_class(static_root_dir: str, tools_root_dir: str) -> type[http.server.SimpleHTTPRequestHandler]:
    class DevRequestHandler(http.server.SimpleHTTPRequestHandler):
        """Serve `static/` at `/` and `tools/` at `/tools/`."""

        static_root = static_root_dir
        tools_root = tools_root_dir

        def __init__(self, *args, **kwargs):
            kwargs["directory"] = static_root_dir
            super().__init__(*args, **kwargs)

        def _strip_conditional_request_headers(self) -> None:
            for key in ("If-Modified-Since", "If-None-Match"):
                if key in self.headers:
                    del self.headers[key]

        def do_GET(self) -> None:
            self._strip_conditional_request_headers()
            super().do_GET()

        def do_HEAD(self) -> None:
            self._strip_conditional_request_headers()
            super().do_HEAD()

        def translate_path(self, path: str) -> str:
            path = urllib.parse.unquote(path)
            path = path.split("?", 1)[0].split("#", 1)[0]
            path = path.replace("\\", "/")
            words = [w for w in path.split("/") if w and w != "."]
            if words and words[0] == "tools":
                directory = self.tools_root
                words = words[1:]
            else:
                directory = self.static_root
                if not words:
                    words = ["index.html"]
            fs_path = directory
            for word in words:
                if os.path.dirname(word):
                    continue
                if word == os.curdir:
                    continue
                if word == os.pardir:
                    dirup = os.path.dirname(fs_path)
                    if dirup != fs_path:
                        fs_path = dirup
                    continue
                fs_path = os.path.join(fs_path, word)
            return fs_path

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            super().end_headers()

    return DevRequestHandler


def _find_free_port(start: int) -> tuple[socketserver.TCPServer, int]:
    port = start
    handler = _make_handler_class(STATIC_ROOT, TOOLS_ROOT)
    while port < start + MAX_PORTS_TO_TRY:
        try:
            httpd = socketserver.TCPServer(("", port), handler)
            return httpd, port
        except OSError as e:
            if e.errno in _ADDR_IN_USE:
                print(f"Port {port} is busy, trying port {port + 1}...")
                port += 1
            else:
                raise
    raise RuntimeError(f"Could not find a free port between {start} and {port - 1}.")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Serve static/ (site root) and tools/ under /tools/.")
    parser.add_argument(
        "--generic",
        action="store_true",
        help=f"Open the generic template editor ({GENERIC_EDITOR_PATH}) in the browser.",
    )
    args = parser.parse_args(argv)

    httpd, port = _find_free_port(PORT)
    base = f"http://localhost:{port}"
    open_url = base + (GENERIC_EDITOR_PATH if args.generic else "/")

    print(f"Successfully started server on {base}")
    print(f"Serving static from: {STATIC_ROOT}")
    print(f"Serving tools from:  {TOOLS_ROOT}  →  {base}/tools/")
    print("Opening in your default browser...")

    try:
        webbrowser.open_new_tab(open_url)
    except webbrowser.Error:
        print("\n---------------------------------------------------")
        print("Could not automatically open your browser.")
        print(f"Please manually open this URL: {open_url}")
        print("---------------------------------------------------\n")

    print("\n---------------------------------------------------")
    print("Your project is now running.")
    print("Keep this terminal window open to keep it running.")
    print("To stop the server, close this window or press Ctrl+C.")
    print("---------------------------------------------------\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
