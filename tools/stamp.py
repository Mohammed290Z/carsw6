"""Cache-busting: tag every local CSS/JS reference with ?v=<content hash>.

GitHub Pages tells browsers to reuse files for 10 minutes, so after an update a visitor could keep
running old code. Run this before each push: when a file's content changes, its tag changes, and
browsers fetch the new file immediately. Unchanged files keep their tag and stay cached.

Usage:  python3 tools/stamp.py
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# file that holds the reference -> [(reference as written, file it points to)]
REFS = {
    "index.html": [("assets/css/site.css", "assets/css/site.css"), ("assets/js/app.js", "assets/js/app.js")],
    "legal.html": [("assets/css/site.css", "assets/css/site.css")],
    "admin/index.html": [("admin.css", "admin/admin.css"), ("admin.js", "admin/admin.js")],
    "assets/js/app.js": [("./config.js", "assets/js/config.js"), ("./i18n.js", "assets/js/i18n.js"),
                         ("./cars-meta.js", "assets/js/cars-meta.js")],
    "admin/admin.js": [("../assets/js/config.js", "assets/js/config.js")],
}
# a module's tag must also change when something it imports changes
DEPENDS = {
    "assets/js/app.js": ["assets/js/config.js", "assets/js/i18n.js", "assets/js/cars-meta.js"],
    "admin/admin.js": ["assets/js/config.js"],
}


def digest(path: str) -> str:
    h = hashlib.sha256((ROOT / path).read_bytes())
    for dep in DEPENDS.get(path, []):
        h.update((ROOT / dep).read_bytes())
    return h.hexdigest()[:10]


def main():
    # leaves first, so a module's own imports are stamped before its hash is taken
    order = ["assets/js/app.js", "admin/admin.js", "index.html", "legal.html", "admin/index.html"]
    for holder in order:
        text = (ROOT / holder).read_text()
        for ref, target in REFS[holder]:
            pattern = re.compile(r"(['\"])" + re.escape(ref) + r"(\?v=[0-9a-f]+)?(['\"])")
            text, n = pattern.subn(lambda m: f"{m.group(1)}{ref}?v={digest(target)}{m.group(3)}", text)
            if not n:
                raise SystemExit(f"{holder}: reference to {ref} not found")
        (ROOT / holder).write_text(text)
    print("stamped")


if __name__ == "__main__":
    main()
