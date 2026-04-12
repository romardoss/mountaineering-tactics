import errno
import http.server
import os
import socketserver
import webbrowser

# --- Configuration ---
PORT = 8000
MAX_PORTS_TO_TRY = 20
STATIC_DIR = "static"
# Same document root as: wrangler pages dev static/
STATIC_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), STATIC_DIR)
# ---


class MyRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Serve the `static/` tree like Wrangler Pages (root = index.html)."""

    def __init__(self, *args, **kwargs):
        kwargs["directory"] = STATIC_ROOT
        super().__init__(*args, **kwargs)

    def _strip_conditional_request_headers(self) -> None:
        """Avoid 304 Not Modified so the client never reuses a stale body.

        stdlib send_head() returns 304 when If-Modified-Since matches the file
        mtime; browsers then keep an old cached copy (e.g. images/image.json)
        even if Cache-Control says no-store.
        """
        for key in ("If-Modified-Since", "If-None-Match"):
            if key in self.headers:
                del self.headers[key]

    def do_GET(self) -> None:
        self._strip_conditional_request_headers()
        super().do_GET()

    def do_HEAD(self) -> None:
        self._strip_conditional_request_headers()
        super().do_HEAD()

    def translate_path(self, path):
        # Only normalize the bare site root; everything else uses stdlib
        # (query strip, %XX decoding, safe path joining — fixes images with spaces, etc.)
        root = path.split("?", 1)[0].split("#", 1)[0]
        if root in ("/", ""):
            path = "/index.html"
        return super().translate_path(path)

    def end_headers(self):
        # Strong anti-cache for local dev (incl. JSON manifests and HTML).
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


httpd = None
port = PORT
# Errno for "address already in use" differs by OS (e.g. Linux 98, Windows 10048).
_ADDR_IN_USE = {errno.EADDRINUSE}
if hasattr(errno, "WSAEADDRINUSE"):
    _ADDR_IN_USE.add(errno.WSAEADDRINUSE)

while port < PORT + MAX_PORTS_TO_TRY:
    try:
        httpd = socketserver.TCPServer(("", port), MyRequestHandler)
        break
    except OSError as e:
        if e.errno in _ADDR_IN_USE:
            print(f"Port {port} is busy, trying port {port + 1}...")
            port += 1
        else:
            raise

if httpd is None:
    print(f"Error: Could not find a free port between {PORT} and {port - 1}.")
    exit(1)


url = f"http://localhost:{port}"
print(f"Successfully started server on {url}")
print("Opening in your default browser...")

try:
    webbrowser.open_new_tab(url)
except webbrowser.Error:
    print("\n---------------------------------------------------")
    print("Could not automatically open your browser.")
    print(f"Please manually open this URL: {url}")
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
