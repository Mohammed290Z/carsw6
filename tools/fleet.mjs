// Publishes the fleet and the booking facts as assets/data/fleet.json, for the customer app.
//
// assets/js/config.js stays the one place to edit cars, prices and business details; this writes
// the same data as plain JSON the app downloads at start (so a price change on the site reaches the
// app without an app update). Run it with tools/stamp.py before each push:
//
//   node tools/fleet.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { BUSINESS, CARS, PLACES } = await import(join(root, 'assets/js/config.js'));
const META = (await import(join(root, 'assets/js/cars-meta.js'))).default;

const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const image = key => ({
  // paths relative to the site root; the app prefixes the site URL
  webp: [800, 1200].map(w => ({ w, src: `assets/cars/${key}-${w}.webp` })),
  aspect: META[key] ? +(META[key].w / META[key].h).toFixed(4) : 1.9,
});

const fleet = {
  version: 1,
  currency: 'MAD',
  cars: CARS.map(c => ({
    id: slug(`${c.make} ${c.model}`),
    name: `${c.make} ${c.model}`,          // exactly what a reservation stores as `car`
    make: c.make, model: c.model,
    price: c.price, deposit: c.deposit,
    power: c.power, accel: c.accel, seats: c.seats, len: c.len,
    tags: c.tags, featured: c.featured,
    image: image(c.img.q),
    the: c.the, alt: c.alt, pitch: c.pitch,
  })),
  places: PLACES,
  business: {
    name: BUSINESS.name,
    whatsapp: BUSINESS.whatsapp, whatsappDisplay: BUSINESS.whatsappDisplay,
    depositReleaseHours: BUSINESS.depositReleaseHours, insuranceExcess: BUSINESS.insuranceExcess,
    minAge: BUSINESS.minAge, licenseYears: BUSINESS.licenseYears,
    acceptCrypto: BUSINESS.acceptCrypto,
    cryptoWallets: (BUSINESS.cryptoWallets ?? []).filter(w => w.address)
      .map(({ coin, network, address, rateId, decimals }) => ({ coin, network, address, rateId, decimals })),
  },
};

const out = join(root, 'assets/data/fleet.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(fleet, null, 1) + '\n');
console.log(`fleet.json: ${fleet.cars.length} cars`);
