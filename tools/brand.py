"""Brand assets: favicon, touch icon, 512px icon and the 1200x630 link preview, all built from
the CARSW6 wordmark traced by tools/logo.py.

Usage:  python tools/brand.py      (needs pillow, numpy, potracer; uses macOS's Bodoni 72)
Run tools/cutout.py first: the preview is built from the Range Rover composite.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from logo import logo_mask

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/brand"
BODONI = "/System/Library/Fonts/Supplemental/Bodoni 72.ttc"
INK, SAND, MIST = (11, 16, 38), (239, 232, 220), (154, 162, 198)
MASK = logo_mask()


def wordmark(width, color):
    """The logo at a given width, as an RGBA image in one colour."""
    h = round(width * MASK.shape[0] / MASK.shape[1])
    alpha = Image.fromarray((MASK * 255).astype(np.uint8)).resize((width, h), Image.LANCZOS)
    img = Image.new("RGBA", (width, h), color + (0,))
    img.putalpha(alpha)
    return img


def icon(size):
    s = 4  # draw large, then downsample for clean edges
    img = Image.new("RGBA", (size * s, size * s), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, size * s - 1, size * s - 1), radius=size * s * .2, fill=INK)
    mark = wordmark(round(size * s * .82), SAND)
    img.alpha_composite(mark, ((img.width - mark.width) // 2, (img.height - mark.height) // 2))
    return img.resize((size, size), Image.LANCZOS)


def panel_icon(size, maskable=False):
    """App icon for the staff panel. Maskable icons keep the logo inside the central 80% safe zone,
    because Android may crop them to a circle or squircle."""
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), INK + (255,))
    if not maskable:
        img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle((0, 0, S - 1, S - 1), radius=S * .2, fill=INK)
    mark = wordmark(round(S * (.62 if maskable else .8)), SAND)
    img.alpha_composite(mark, ((S - mark.width) // 2, (S - mark.height) // 2 - round(S * .04)))
    label = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", round(S * .075))
    ImageDraw.Draw(img).text((S / 2, (S + mark.height) / 2 + S * .03), "PANNEAU", font=label, fill=(217, 178, 111), anchor="ma")
    return img.resize((size, size), Image.LANCZOS)


def og_image():
    car = Image.open(ROOT / "assets/cars/composites/range-rover-sport-34.jpg").convert("RGB")
    car = car.resize((1040, round(car.height * 1040 / car.width)), Image.LANCZOS)
    # the composite's edges fade to the page navy, so it sits seamlessly on a navy canvas
    img = Image.new("RGBA", (1200, 630), INK + (255,))
    img.paste(car, (230, 10))
    mark = wordmark(250, SAND)
    img.alpha_composite(mark, (56, 52))
    d = ImageDraw.Draw(img)
    d.text((56, 560), "Location de voitures premium à Casablanca", font=ImageFont.truetype(BODONI, 34, index=0), fill=SAND, anchor="ls")
    d.text((56, 596), "Livrées à l’aéroport Mohammed V, à votre hôtel ou à votre villa",
           font=ImageFont.truetype(BODONI, 22, index=0), fill=MIST, anchor="ls")
    img.convert("RGB").save(OUT / "og-image.jpg", quality=88, optimize=True)


def favicon_svg():
    """Navy tile with the traced wordmark, reusing the logo's own path."""
    logo = (OUT / "carsw6-logo.svg").read_text()
    vb = logo.split('viewBox="')[1].split('"')[0]
    w, h = (float(v) for v in vb.split()[2:])
    path = logo.split("<path", 1)[1].split("/>", 1)[0]
    scale = 52 / w
    (OUT / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="13" fill="#0B1026"/>'
        f'<g transform="translate(6 {32 - h * scale / 2:.2f}) scale({scale:.5f})"><path{path.replace("currentColor", "#EFE8DC")}/></g></svg>\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    favicon_svg()
    icon(32).save(OUT / "favicon-32.png")
    icon(180).save(OUT / "apple-touch-icon.png")
    icon(512).save(OUT / "icon-512.png")
    og_image()
    (ROOT / "admin/icons").mkdir(exist_ok=True)
    panel_icon(192).save(ROOT / "admin/icons/icon-192.png")
    panel_icon(512).save(ROOT / "admin/icons/icon-512.png")
    panel_icon(512, maskable=True).save(ROOT / "admin/icons/maskable-512.png")
    panel_icon(180, maskable=True).convert("RGB").save(ROOT / "admin/icons/apple-touch-icon.png")
    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
