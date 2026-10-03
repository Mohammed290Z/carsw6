"""Car outlines for tools/cutout.py, from a background-removal model.

A colour rule can't tell a white reflection on a glossy black bonnet from the white studio behind
it: where the two touch, the old cutout bit notches into the body. This runs a segmentation model
(rembg, isnet-general-use) once per original photo and saves its car mask as
assets/cars/masks/<name>.png. cutout.py then treats anything the mask calls "car" as car, and
anything it is sure is background (the watermark, a studio shadow baked into the photo) as empty.

The masks are committed, so cutout.py itself never needs the model. Run this only when a photo is
added or replaced (the model, ~180 MB, downloads to ~/.rembg on first use):

  uv run --with "rembg[cpu]" --with pillow python tools/masks.py              all photos
  uv run --with "rembg[cpu]" --with pillow python tools/masks.py audi-q8-34   just these
"""
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/cars/originals"
OUT = ROOT / "assets/cars/masks"


def main():
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-general-use")
    for path in sorted(SRC.glob("*.png")):
        if only and path.stem not in only:
            continue
        mask = remove(Image.open(path).convert("RGB"), session=session, only_mask=True)
        mask.save(OUT / f"{path.stem}.png", optimize=True)
        print(f"{path.stem}: mask saved")


if __name__ == "__main__":
    main()
