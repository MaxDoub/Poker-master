#!/usr/bin/env python3
"""Genere les icones PNG de Poker Master (pique blanc sur feutre vert).

Aucune dependance : encodage PNG a la main via zlib.
Usage : python3 tools/make_icons.py
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"

BG_TOP = (14, 74, 55)
BG_BOTTOM = (6, 38, 29)
FG = (245, 247, 245)


def inside_spade(x, y):
    """x, y normalises dans [-1, 1], y vers le bas. True si le pixel est dans le pique."""
    # Deux lobes ronds en bas de la tete
    for cx in (-0.36, 0.36):
        if (x - cx) ** 2 + (y - 0.06) ** 2 <= 0.42 ** 2:
            return True
    # Triangle pointe vers le haut
    if -0.88 <= y <= 0.20:
        t = (y + 0.88) / 1.08          # 0 a la pointe, 1 a la base
        half = 0.78 * t
        if abs(x) <= half:
            return True
    # Pied evase
    if 0.02 <= y <= 0.90:
        t = (y - 0.02) / 0.88
        half = 0.06 + 0.40 * t ** 2.6
        if abs(x) <= half:
            return True
    return False


def render(size):
    rows = []
    r = size / 2.0
    scale = 1.0 / (r * 0.72)           # le pique occupe ~72% de la largeur
    for py in range(size):
        row = bytearray()
        # Degrade vertical du feutre
        t = py / (size - 1)
        bg = tuple(round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        for px in range(size):
            # Anti-aliasing 2x2
            hits = 0
            for ox, oy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):
                nx = (px + ox - r) * scale
                ny = (py + oy - r) * scale
                if inside_spade(nx, ny):
                    hits += 1
            a = hits / 4.0
            row += bytes(round(bg[i] + (FG[i] - bg[i]) * a) for i in range(3))
        rows.append(bytes(row))
    return rows


def write_png(path, size):
    rows = render(size)
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)
    print(f"{path.name}  {size}x{size}  {len(png) / 1024:.1f} Ko")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    write_png(OUT / "icon-192.png", 192)
    write_png(OUT / "icon-512.png", 512)
    write_png(OUT / "apple-touch-icon.png", 180)
    write_png(OUT / "favicon-32.png", 32)
