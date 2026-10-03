"""Trace the CARSW6 wordmark out of the studio photos into a single-colour SVG.

The same logo sits in the bottom-left corner of the studio photos; assets/brand/logo-source.png is
one copy of it, cut from the first photo shoot so the brand doesn't depend on which cars are in the
fleet. This upsamples it and traces it with potrace. The SVG uses currentColor so CSS sets its colour.

Usage:  python tools/logo.py      (needs pillow, numpy, potracer)
"""
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/brand/logo-source.png"
OUT = ROOT / "assets/brand/carsw6-logo.svg"


def logo_mask():
    """The wordmark as a boolean array (ink = True), 4x the size it appears in the photos."""
    region = Image.open(SRC).convert("L")
    big = region.resize((region.width * 4, region.height * 4), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2))
    ink = np.asarray(big) < 128
    ys, xs = np.where(ink)
    return ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main():
    ink = np.pad(logo_mask(), 8)              # potrace needs a margin around the shapes
    h, w = ink.shape
    # potracer fills the zero pixels, so hand it the background as True
    curves = potrace.Bitmap(~ink).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=.3)
    d = []
    for curve in curves:
        s = curve.start_point
        d.append(f"M{s.x:.1f} {s.y:.1f}")
        for seg in curve:
            if seg.is_corner:
                d.append(f"L{seg.c.x:.1f} {seg.c.y:.1f}L{seg.end_point.x:.1f} {seg.end_point.y:.1f}")
            else:
                d.append(f"C{seg.c1.x:.1f} {seg.c1.y:.1f} {seg.c2.x:.1f} {seg.c2.y:.1f} {seg.end_point.x:.1f} {seg.end_point.y:.1f}")
        d.append("Z")
    OUT.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="CARSW6">'
                   f'<path fill="currentColor" fill-rule="evenodd" d="{"".join(d)}"/></svg>\n')
    print(OUT.name, w, h)


if __name__ == "__main__":
    main()
