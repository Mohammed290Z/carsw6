"""Cut fleet photos out of their white studio background and stage them for the site.

For every image in assets/cars/originals/*.png this writes:
  assets/cars/<name>-<w>.avif|.webp   the car alone, transparent, at WEB_WIDTHS — no built-in shadow
                                      or reflection: the page draws the only contact shadow
  assets/cars/composites/<name>.jpg   2400x1350 still on the site's navy floor, with shadow and
                                      reflection (social posts, listings, og:image)
  assets/cars/cars.json               where the ground line sits in each cutout, for placement
  assets/js/cars-meta.js              the same, as a module the page imports (no extra request)

Stage geometry. The page stands every car in the same way: a glowing ring on the floor around
its wheels, a soft shadow under the body and a darker one at each tyre. All of it is computed here
from the car's wheel contact points, recorded once per photo in assets/cars/anchors.json (use
tools/anchors.html to click them). Nothing on the page is tuned per car.

Every car gets the same finish so the fleet reads as one shoot: a cool grade that sits the black
studio paint in the night scene, a warm rim light from the gold ring below, a 2x Lanczos upscale
with light sharpening, and identical output size and compression.

The studio watermark (and any other artwork that isn't touching the car) is dropped:
only the largest connected shape — the car plus its contact shadow — is kept.

Usage:  python tools/cutout.py                 all photos      (needs pillow, numpy, scipy)
        python tools/cutout.py audi-rs3-34     just these, keeping the others' data
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/cars/originals"
OUT = ROOT / "assets/cars"
COMP = OUT / "composites"

NAVY = np.array([11, 16, 38], float)      # --ink
DEEP = np.array([30, 44, 110], float)     # backlight behind the car
BLUE = np.array([58, 85, 255], float)     # --majorelle
BRASS = np.array([217, 178, 111], float)  # --brass

BG_THRESHOLD = 120   # below this a pixel is always car (or its contact shadow)
STUDIO_WHITE = 245   # the studio backdrop itself
EDGE_REACH = 8       # px the background may reach from the backdrop into a soft edge
REFLECT_DEPTH = .42  # reflection length as a share of car height
REFLECT_ALPHA = .30

COOL = np.array([-.04, 0, .08])        # midtone tint toward blue; highlights (plates, LEDs) stay neutral
NAVY_LIFT = np.array([3, 7, 20], float)  # deepest blacks lifted toward the page navy
RIM_WIDTH = 4.0      # px at source resolution
RIM_STRENGTH = .7
CAR_SPAN = 1600      # output width of the car itself, px — same for every view
ANCHORS = OUT / "anchors.json"
META_JS = ROOT / "assets/js/cars-meta.js"
RING_MARGIN_X = 1.18    # ring reaches this far past the outermost wheels…
RING_MIN_X = 1.04       # …and at least just past the body's own width
RING_DEPTH = 1.9        # ring depth relative to the wheels' spread front to back
CONTACT_W = .085        # tyre contact shadow width, as a share of the car's width in the image
WEB_WIDTHS = (800, 1200, 1600)  # capped at 1600: the source renders are ~950px, so 2400 would be empty upscaling
AVIF_QUALITY = 50
WEBP_QUALITY = 75


def grade(color, body, ground, top):
    """Cool the car into the navy scene and catch the ring's warm light on its flanks."""
    lum = color.mean(2, keepdims=True) / 255
    graded = color * (1 + COOL * (1 - lum)) + NAVY_LIFT * (1 - lum) ** 3
    inside = ndimage.distance_transform_edt(body)
    rows = np.arange(color.shape[0])[:, None]
    low = np.clip((rows - top) / np.maximum(ground[None, :] - top, 1), 0, 1)  # 0 at the roof, 1 at the ground
    # flanks and pillars only: nothing on the roof, and nothing near the ground where the
    # opaque contact shadow would otherwise pick up a glowing outline
    band = np.clip(1 - np.abs(low - .42) / .32, 0, 1) ** .8
    rim = np.exp(-inside / RIM_WIDTH) * band * body
    graded = 255 - (255 - graded) * (1 - BRASS / 255 * RIM_STRENGTH * rim[..., None])  # screen blend
    return np.where(body[..., None], graded.clip(0, 255), color)


def finish(rgba, meta):
    """Upscale so every car spans CAR_SPAN px, then sharpen. Premultiplied, so edges don't fringe."""
    scale = CAR_SPAN / ((meta["carRight"] - meta["carLeft"]) * meta["w"])
    size = (round(meta["w"] * scale), round(meta["h"] * scale))
    a = rgba[..., 3:4]
    pre = Image.fromarray(np.concatenate([rgba[..., :3] * a, a * 255], 2).clip(0, 255).astype(np.uint8), "RGBA")
    big = np.asarray(pre.resize(size, Image.LANCZOS)).astype(float)
    a = big[..., 3:4] / 255
    rgb = np.where(a > 1e-3, big[..., :3] / np.maximum(a, 1e-3), 0)
    rgb = Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=3))
    out = np.concatenate([np.asarray(rgb).astype(float), np.clip((a - .02) / .98, 0, 1)], 2)
    return out, {**meta, "w": size[0], "h": size[1]}


def cut(path):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(float)
    H, W, _ = rgb.shape
    lo = rgb.min(2)

    # 1. studio background: true white connected to the border, then grown a few px into the
    #    soft edge. Paint reflections touching the silhouette are grey, never white, so they
    #    stop the fill instead of being eaten by it.
    labels, _ = ndimage.label(lo > STUDIO_WHITE)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border > 0])
    bg = ndimage.binary_dilation(bg, iterations=EDGE_REACH, mask=lo > BG_THRESHOLD) | bg

    # studio floor showing through gaps the car encloses (under sills, between wheels):
    solid, n = ndimage.label(~bg & (lo <= BG_THRESHOLD))
    solid = solid == np.argmax(np.bincount(solid.ravel())[1:]) + 1  # the car, not the watermark
    sy = np.where(solid.any(1))[0]
    frac = lambda y: (y - sy.min()) / (sy.max() - sy.min())
    lower = np.zeros_like(bg)
    lower[int(sy.min() + (sy.max() - sy.min()) * .6):] = True

    # near the ground, the studio shadow fades to white over far more than EDGE_REACH px;
    # any neutral grey there that connects to the background is that shadow, not paint
    ground_band = np.zeros_like(bg)
    ground_band[int(sy.min() + (sy.max() - sy.min()) * .78):] = True
    greys, _ = ndimage.label(~bg & (lo > BG_THRESHOLD) & ground_band)
    touching = np.unique(greys[ndimage.binary_dilation(bg) & (greys > 0)])
    bg |= np.isin(greys, touching[touching > 0])

    pockets, n = ndimage.label(~bg & (lo > 140) & lower)
    for i, sl in enumerate(ndimage.find_objects(pockets), 1):
        blob = pockets == i
        # must contain real studio white (not a silver rim) and reach down to the sills (not a plate)
        if (blob[sl] & (lo[sl] > 230)).sum() > 40 and frac(sl[0].stop) >= .78:
            bg |= ndimage.binary_dilation(blob, iterations=3) & (lo > BG_THRESHOLD) & lower

    # 2. inside the background, un-mix white so soft edges and shadows become translucent black;
    #    alpha reaches 1 exactly at the threshold, so it meets the solid car without a seam
    alpha = np.where(bg, (255 - lo) / (255 - BG_THRESHOLD), 1.0)
    alpha = np.clip((alpha - .04) / .96, 0, 1)
    #    background pixels are shadow or edge falloff, so they carry black, never grey
    color = np.where(bg[..., None], 0.0, rgb)

    # 3. keep only the car: largest shape, plus anything sitting inside its bounds (mirrors, antennas)
    shapes, n = ndimage.label(alpha > .08)
    sizes = ndimage.sum(np.ones_like(alpha), shapes, range(1, n + 1))
    car_id = int(np.argmax(sizes)) + 1
    ys, xs = np.where(shapes == car_id)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    keep = shapes == car_id
    for i, sl in enumerate(ndimage.find_objects(shapes), 1):
        if i != car_id and sl[0].start >= y0 and sl[0].stop <= y1 + 1 and sl[1].start >= x0 and sl[1].stop <= x1 + 1:
            keep |= shapes == i
    alpha = np.where(ndimage.binary_dilation(keep, iterations=2), alpha, 0)
    body = (~bg) & keep

    # 4. ground line: lowest solid pixel under the rear and front wheels, joined by a straight line
    cols = np.where(body.any(0))[0]
    cx0, cx1 = cols.min(), cols.max()
    third = (cx1 - cx0) // 3
    def contact(a, b):
        sub = body[:, a:b]
        rows = np.where(sub.sum(1) >= 6)[0]
        y = rows.max()
        x = a + int(np.mean(np.where(sub[y])[0]))
        return x, y
    (lx, ly), (rx, ry) = contact(cx0, cx0 + third), contact(cx1 - third, cx1)
    ground = ly + (np.arange(W) - lx) * (ry - ly) / max(rx - lx, 1)

    # everything under the ground line is cast shadow: make it black and let the floor show through
    below = np.arange(H)[:, None] > ground[None, :] + 2
    shadow = below & (alpha > 0)
    alpha = np.where(shadow, np.minimum(alpha, (255 - lo) / 255 * .9), alpha)
    color = np.where(shadow[..., None], 0.0, color)
    body &= ~below
    # the studio render fades each edge to white over several px; choke that falloff so the
    # silhouette ends crisply instead of trailing a dark fringe
    alpha = np.where(bg & ~below, alpha ** 2.2, alpha)
    color = grade(color, body, ground, y0)

    car_h = y1 - y0
    pad_b = int(car_h * REFLECT_DEPTH) + 12
    canvas_h = H + pad_b
    rgba = np.zeros((canvas_h, W, 4))
    rgba[:H, :, :3] = color
    rgba[:H, :, 3] = alpha

    # 5. mirror the car body (not its shadow) about the ground line, column by column
    src_a = alpha * ndimage.binary_dilation(body, iterations=2)
    refl = np.zeros((canvas_h, W, 4))
    yy = np.arange(canvas_h)
    for x in range(cx0, cx1 + 1):
        g = ground[x]
        src_y = np.round(2 * g - yy).astype(int)
        ok = (yy > g) & (src_y >= 0) & (src_y < H)
        d = (yy[ok] - g) / (car_h * REFLECT_DEPTH)
        fade = np.clip(1 - d, 0, 1) ** 1.8 * REFLECT_ALPHA
        refl[yy[ok], x, :3] = color[src_y[ok], x]
        refl[yy[ok], x, 3] = src_a[src_y[ok], x] * fade
    refl_img = Image.fromarray((refl * [1, 1, 1, 255]).clip(0, 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(1.6))
    refl = np.asarray(refl_img).astype(float) / [1, 1, 1, 255]

    # car over its reflection
    a_top = rgba[..., 3:4]
    out = np.zeros_like(rgba)
    out[..., 3:4] = a_top + refl[..., 3:4] * (1 - a_top)
    out[..., :3] = (rgba[..., :3] * a_top + refl[..., :3] * refl[..., 3:4] * (1 - a_top)) / np.maximum(out[..., 3:4], 1e-4)

    # the bare car for the web: body plus a 2px anti-aliased edge, nothing under the ground line,
    # choked by 1px so the studio's light edge falloff can't show as a halo on the navy page
    # past the wheels (overhangs) the shadow pad sits just above the contact line; no tyre
    # reaches down there, so clip it flat at contact height
    span_px = cx1 - cx0
    xs_all = np.arange(W)[None, :]
    rows_all = np.arange(H)[:, None]
    overhang = ((xs_all < lx - .04 * span_px) & (rows_all > ly - .012 * car_h)) | \
               ((xs_all > rx + .04 * span_px) & (rows_all > ry - .012 * car_h))
    bare_a = np.where(ndimage.binary_dilation(body, iterations=2) & ~below & ~overhang, alpha, 0)
    bare_a = np.minimum(bare_a, ndimage.minimum_filter(bare_a, size=3))
    bare = np.zeros((H, W, 4))
    bare[..., :3] = color
    bare[..., 3] = bare_a

    # 6. trim each version to its content with a small margin
    m = 16
    ty0, tx0, tx1 = max(y0 - m, 0), max(cx0 - m, 0), min(cx1 + m, W - 1)
    def trimmed(img, bottom):
        img = img[ty0:bottom, tx0:tx1 + 1]
        return img, {
            "w": img.shape[1], "h": img.shape[0],
            # ground contact, as fractions of the trimmed image
            "groundY": round(float(max(ly, ry) - ty0) / img.shape[0], 4),
            "carLeft": round(float(cx0 - tx0) / img.shape[1], 4),
            "carRight": round(float(cx1 - tx0) / img.shape[1], 4),
            # where this cutout sits in the original photo: maps anchors onto it
            "crop": [int(tx0), int(ty0), int(img.shape[1]), int(img.shape[0])],
        }
    staged = trimmed(out, min(int(max(ly, ry) + car_h * REFLECT_DEPTH) + m, canvas_h))
    web = trimmed(bare, min(int(max(ly, ry)) + m, H))
    return staged, web


def floor(W, H, ground_y, cx, car_px, car_m=4.6):
    """The site's zellige floor, projected like the WebGL scene: square grid + diamond lattice."""
    ppm = car_px / car_m
    z0, cam_h = 8.0, 1.25
    f = ppm * z0
    horizon = ground_y - cam_h * f / z0
    y, x = np.mgrid[0:H, 0:W].astype(float)
    below = y > horizon + 2
    z = np.where(below, cam_h * f / np.maximum(y - horizon, 1e-3), 1e9)
    wx = (x - cx) * z / f
    wz = z - z0
    fw = z / f * 1.1 * 1.4  # one pixel, in pattern units

    def fam(v):
        d = np.abs((v % 1) - .5)
        return np.clip(1 - d / (fw * 1.2), 0, 1) * (1 - np.clip((fw - .08) / .22, 0, 1))

    p, q = wx * 1.1, wz * 1.1
    sq = np.maximum(fam(p + .5), fam(q + .5))
    di = np.maximum(fam(p + q), fam(p - q))
    r = np.hypot(wx, wz)
    fade = np.exp(-r * .32) * below
    tint = BRASS + (BLUE - BRASS) * np.clip((r - 1.5) / 3.5, 0, 1)[..., None]
    c = tint * ((sq * .5 + di * .3) * fade)[..., None]
    c += BRASS * (.10 * np.exp(-r * r * .3) * below)[..., None]
    return c


def composite(cutout, meta, name, W=2400, H=1350):
    car_px = int(W * .6)
    scale = car_px / ((meta["carRight"] - meta["carLeft"]) * meta["w"])
    img = Image.fromarray((cutout * [1, 1, 1, 255]).clip(0, 255).astype(np.uint8), "RGBA")
    img = img.resize((round(meta["w"] * scale), round(meta["h"] * scale)), Image.LANCZOS)
    ground_y = int(H * .74)
    left = (W - car_px) // 2 - int(meta["carLeft"] * img.width)
    top = ground_y - int(meta["groundY"] * img.height)

    y, x = np.mgrid[0:H, 0:W].astype(float)
    # backlight so a black car still separates from the navy
    glow = np.exp(-(((x - W / 2) / (W * .36)) ** 2 + ((y - ground_y + H * .2) / (H * .34)) ** 2))
    base = NAVY + (DEEP - NAVY) * glow[..., None] * .9
    base = base + floor(W, H, ground_y, W / 2, car_px)
    vign = np.clip(1 - (((x - W / 2) / W) ** 2 + ((y - H / 2) / H) ** 2) * 1.3, 0, 1)
    base = NAVY + (base - NAVY) * vign[..., None]

    bg = Image.fromarray(base.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")
    bg.alpha_composite(img, (left, top))
    COMP.mkdir(parents=True, exist_ok=True)
    bg.convert("RGB").save(COMP / f"{name}.jpg", quality=90, optimize=True)


def stage(car, meta, anchors):
    """Clip what's left of the studio floor under the tyres, and fit the ring and shadows.

    anchors: wheel contact points in original-photo pixels — nearRear, nearFront, farFront.
    Returns the car with its floor clipped, and the geometry as fractions of the image
    (x of width, y of height) so it holds at every rendered size.
    """
    x0, y0, cw, ch = meta["crop"]
    H, W = car.shape[:2]
    to_px = lambda p: np.array([(p[0] - x0) / cw * W, (p[1] - y0) / ch * H])
    nr, nf, ff = (to_px(anchors[k]) for k in ("nearRear", "nearFront", "farFront"))
    fr = nr + (ff - nf)                        # hidden far-rear wheel completes the footprint

    # 1. the ground runs through the visible contacts; anything below it is studio floor
    chain = sorted([nr, nf, ff], key=lambda p: p[0])
    xs = np.arange(W)
    ground = np.interp(xs, [p[0] for p in chain], [p[1] for p in chain])
    rows = np.arange(H)[:, None]
    feather = 3 * W / 1600
    keep = np.clip(1 - (rows - (ground[None, :] + feather)) / feather, 0, 1)
    car = car.copy()
    car[..., 3] *= keep

    # the studio floor also shows between the tyres, above that line: inside the footprint,
    # fade the dark, flat pixels so the page's own contact shadow shows through instead
    pts = np.array([nr, nf, ff, fr])
    centre = pts.mean(0)
    poly = [tuple(centre + (p - centre) * 1.08) for p in pts]
    inside = Image.new("L", (W, H), 0)
    ImageDraw.Draw(inside).polygon(poly, fill=255)
    inside = np.asarray(inside.filter(ImageFilter.GaussianBlur(6 * W / 1600))) / 255
    lum = car[..., :3].mean(2)
    floorish = np.clip((70 - lum) / 45, 0, 1) * inside   # dark = floor; rims and highlights stay
    car[..., 3] *= 1 - floorish * .92

    # 2. ring: an ellipse around all four contacts, wide enough to clear the body
    cx, cy = pts.mean(0)
    span = (meta["carRight"] - meta["carLeft"]) * W
    rx = max(np.abs(pts[:, 0] - cx).max() * RING_MARGIN_X, span / 2 * RING_MIN_X)
    ry = max(np.abs(pts[:, 1] - cy).max() * RING_DEPTH, rx * .1)
    # 3. tyre contact shadows: flattened like the ring
    cwid = span * CONTACT_W
    chgt = cwid * ry / rx * 1.1
    # 4. backlight behind the body: centred at mid-height of the car
    top = np.where(car[..., 3].max(1) > .5)[0].min()
    body_mid = (top + cy) / 2
    r = lambda v: round(float(v), 4)
    return car, {
        "cx": r(cx / W), "cy": r(cy / H), "rx": r(rx / W), "ry": r(ry / H),
        "contacts": [[r(p[0] / W), r(p[1] / H)] for p in (nr, nf, ff, fr)],
        "cw": r(cwid / W), "ch": r(chgt / H),
        "glowY": r(body_mid / H), "glowH": r((cy - top) * 1.6 / H),
    }


def to_image(rgba):
    return Image.fromarray((rgba * [1, 1, 1, 255]).clip(0, 255).astype(np.uint8), "RGBA")


def main():
    only = set(sys.argv[1:])
    manifest = json.loads((OUT / "cars.json").read_text()) if only and (OUT / "cars.json").exists() else {}
    for old in [*OUT.glob("*.webp"), *OUT.glob("*.avif")]:
        if not only or old.stem.rsplit("-", 1)[0] in only:
            old.unlink()
    anchors = json.loads(ANCHORS.read_text()) if ANCHORS.exists() else {}
    for path in sorted(SRC.glob("*.png")):
        if only and path.stem not in only:
            continue
        staged, web = cut(path)
        composite(*finish(*staged), path.stem)
        car, meta = finish(*web)
        if path.stem in anchors:
            car, meta["stage"] = stage(car, meta, anchors[path.stem])
        img = to_image(car)
        for w in WEB_WIDTHS:
            size = (w, round(img.height * w / img.width))
            # premultiply before resizing so the transparent edge doesn't pick up black
            small = img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
            small.save(OUT / f"{path.stem}-{w}.avif", quality=AVIF_QUALITY)
            small.save(OUT / f"{path.stem}-{w}.webp", quality=WEBP_QUALITY, method=6)
        manifest[path.stem] = {**meta, "w": WEB_WIDTHS[-1], "h": round(meta["h"] * WEB_WIDTHS[-1] / meta["w"]),
                               "widths": list(WEB_WIDTHS)}
        print(f"{path.stem}: {manifest[path.stem]}")
    (OUT / "cars.json").write_text(json.dumps(manifest, indent=2))
    META_JS.write_text("// Generated by tools/cutout.py — do not edit.\nexport default " + json.dumps(manifest, indent=2) + ";\n")


if __name__ == "__main__":
    main()
