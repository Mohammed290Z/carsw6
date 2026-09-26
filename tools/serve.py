"""Local preview server: python3 tools/serve.py  →  http://localhost:4174

Serves the site from the project root and forbids caching, so every reload shows the files on disk.
(Opening index.html directly from Finder doesn't work: the page loads ES modules.)
"""
import http.server
import os
import sys

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 4174
print(f"CARSW6 preview on http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
