#!/usr/bin/env python3
"""Serveur statique de developpement : sert le dossier de l'app sans aucun cache.

Le cache HTTP du navigateur garde les modules ES entre deux rechargements, ce qui
masque les modifications. On force donc no-store pendant le developpement.

    python3 tools/devserver.py 8765
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(NoCacheHandler, directory=str(ROOT))
    print(f"Poker Master -> http://localhost:{port}  (racine : {ROOT})")
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
