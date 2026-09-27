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

## Reservations back end (Supabase)

Requests from the booking form are stored in Supabase and managed in the panel at
`/admin/` (https://mohammed290z.github.io/carsw6/admin/).

- `supabase/migrations/` — the database: reservations, team, history, and the security rules.
  Visitors can only submit a request (through `submit_reservation`, with spam limits); staff read and
  update; only admins delete or manage the team. Public sign-ups are off.
- `supabase/functions/notify-reservation` — emails the team about each new request (Resend). Off for
  now (`SUPABASE.emailAlerts` in `config.js`); new requests appear live in the panel.
- `supabase/functions/staff-admin` — invite, change role, remove (admins only).
- `admin/` — the panel.

### One-time setup

1. Create a Supabase project (region: Paris or Frankfurt). Keep the database password safe.
2. `npx supabase login`, then `npx supabase link --project-ref <ref>` (asks for the database password).
3. `npx supabase db push` — creates the tables and rules.
4. `npx supabase config push` — applies the auth settings (no sign-ups, password rules, redirect URLs).
5. `npx supabase functions deploy` — deploys both functions.
6. Optional, email alerts: create a Resend account and an API key, run
   `npx supabase secrets set RESEND_API_KEY=<key> NOTIFY_TO=<your email>`, and set
   `SUPABASE.emailAlerts` to `true` in `assets/js/config.js`.
7. Put the project URL and the `anon` public key in `SUPABASE` in `assets/js/config.js`.
8. In the Supabase dashboard, Authentication → Users → Add user (your email, auto-confirm). Sign in to
   `/admin/` with it: the first account to sign in becomes admin. Invite the rest of the team from
   the panel's Équipe page.

## Crypto payments

Clients who choose crypto pay directly when they book: after sending the request, the site shows the
amount (converted from MAD at the current rate), your wallet address with a copy button and a QR
code, and which network to use. No payment provider and no WhatsApp step.

- Wallet addresses: `cryptoWallets` in `assets/js/config.js`. Only coins with an address are offered;
  with none filled in, the crypto option stays hidden.
- Rates: `open.er-api.com` (MAD → USD) and CoinGecko (coin → USD), fetched in the visitor's browser.
  If either is unavailable, the page shows the MAD amount and asks the client to convert it.
- In the panel, crypto requests arrive as **Crypto à vérifier**: check the wallet, then set
  *Règlement* to **Payé**.
