# CARSW6

Site of CARSW6, premium car rental in Casablanca: Range Rover Sport, Mercedes-AMG CLA 45 S and Audi RS 3,
delivered to Mohammed V Airport, hotels and villas. French, English and Arabic.

A static site — no build step. GitHub Pages serves it straight from this repository.

## Preview locally

```bash
python3 tools/serve.py
```

Then open http://localhost:4174. Useful URL options: `?lang=en`, `?lang=ar`, `?car=1` (open on a given car).

## Before launch

`assets/js/config.js` holds every business fact the site states: WhatsApp number, company name and
registration numbers, deposit and insurance terms, driver requirements, Google reviews. Anything left
at `null` stays hidden. On localhost a banner lists what's still missing.

## Adding or replacing a car

1. Put the studio photo in `assets/cars/originals/` (white background, front three-quarter view).
2. Open http://localhost:4174/tools/anchors.html, pick the photo, click where the three visible tyres
   touch the floor, and paste the result into `assets/cars/anchors.json`.
3. Run `python tools/cutout.py <photo-name>` (needs `pip install pillow numpy scipy`). It cuts the car
   out, grades it, and computes where its ring and shadows go.
4. Add the car to `CARS` in `assets/js/config.js`.

`tools/brand.py` rebuilds the icons and link preview; `tools/logo.py` re-traces the wordmark.
