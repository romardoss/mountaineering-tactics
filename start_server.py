import http.server
import socketserver
import webbrowser
import os

# --- Configuration ---
PORT = 8000
MAX_PORTS_TO_TRY = 20
STATIC_DIR = "static"
# ---

class MyRequestHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        abs_static = os.path.abspath(STATIC_DIR)
        if path == '/':
            path = '/index.html'   
        elif path.startswith('/images'):
            path = path
        else:
            path == '/index.html'
        return os.path.join(abs_static, path.lstrip("/"))

# Change to the script's directory to serve files from the correct location
os.chdir(os.path.dirname(os.path.abspath(__file__)))

httpd = None
port = PORT
# Loop to find an open port
while port < PORT + MAX_PORTS_TO_TRY:
    try:
        httpd = socketserver.TCPServer(("", port), MyRequestHandler)
        # If we get here, the port is free. Break the loop.
        break
    except OSError as e:
        if e.errno == 98: # Address already in use
            print(f"Port {port} is busy, trying port {port + 1}...")
            port += 1
        else:
            # Re-raise other errors
            raise

if httpd is None:
    print(f"Error: Could not find a free port between {PORT} and {port - 1}.")
    exit(1)


url = f"http://localhost:{port}"
print(f"Successfully started server on {url}")
print("Opening in your default browser...")

# Open the URL in a new browser tab
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
    pass
