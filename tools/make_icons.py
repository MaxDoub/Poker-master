#!/usr/bin/env python3
"""Regenere les icones de l'app a partir d'une image source.

L'icone est une photo fournie par l'utilisateur, conservee en pleine taille dans
icons/icon-512.png qui sert de source aux autres formats.

    python3 tools/make_icons.py                  # depuis icons/icon-512.png
    python3 tools/make_icons.py photo.png        # depuis une nouvelle image

Utilise sips, livre avec macOS : aucune dependance a installer.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"

# Nom du fichier -> cote en pixels
TARGETS = {
    "icon-512.png": 512,
    "icon-192.png": 192,
    "apple-touch-icon.png": 180,
    "favicon-32.png": 32,
}


def sips(*args):
    subprocess.run(["sips", *args], check=True, capture_output=True)


def main():
    source = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else ICONS / "icon-512.png"
    if not source.exists():
        raise SystemExit(f"Introuvable : {source}")

    ICONS.mkdir(exist_ok=True)
    staged = ICONS / "_source.png"
    sips("-s", "format", "png", str(source), "--out", str(staged))

    for name, size in TARGETS.items():
        out = ICONS / name
        sips("-Z", str(size), str(staged), "--out", str(out))
        print(f"{name:<22} {size}x{size}  {out.stat().st_size / 1024:.0f} Ko")

    staged.unlink()


if __name__ == "__main__":
    main()
