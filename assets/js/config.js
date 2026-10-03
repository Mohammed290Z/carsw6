/* Everything about the business that the site states as fact lives here.
   A value left at null is not shown on the page, so nothing unconfirmed goes live.
   On localhost, a banner lists whatever is still missing. */

/* The customer app (mobile/). Fill in each link once it exists; never a placeholder. The site's
   app banner only appears when at least one is set (preview it anyway with ?appbanner), and
   app.html sends iPhones to the App Store and Android phones to Google Play, falling back to the
   test builds (TestFlight invite, Android APK from EAS) while the store listings aren't live. */
export const APP = {
  appStore: null,     // e.g. 'https://apps.apple.com/app/carsw6/id0000000000'
  playStore: null,    // e.g. 'https://play.google.com/store/apps/details?id=com.carsw6.app'
  testflight: null,   // public TestFlight link, e.g. 'https://testflight.apple.com/join/XXXXXXXX'
  androidApk: null,   // EAS internal-distribution link for the preview APK
};

export const BUSINESS = {
  name: 'CARSW6',

  // Footer legal block (audit 4.3). Company name and registration numbers as they appear on the RC extract.
  legalName: null,        // e.g. 'CARSW6 SARL'
  rc: null,               // Registre du commerce, e.g. 'Casablanca 123456'
  ice: null,              // Identifiant commun de l'entreprise (15 digits)
  if: null,               // Identifiant fiscal
  address: null,          // e.g. 'Boulevard de la Corniche, Aïn Diab, Casablanca'

  // WhatsApp (audit 4.1, 4.2). International format, digits only: '2126XXXXXXXX'.
  whatsapp: null,
  whatsappDisplay: null,  // how it's printed, e.g. '+212 6 12 34 56 78'

  // Rental terms (audit 3.4, 4.3)
  depositReleaseHours: null,  // card hold released this many hours after the car is returned, e.g. 72
  insuranceExcess: null,      // MAD, e.g. 10000 → "Assurance tous risques incluse, franchise 10 000 MAD"
  minAge: null,               // e.g. 25
  licenseYears: null,         // e.g. 3

  // Crypto: turned on at the owner's request. Note the Office des Changes has prohibited crypto
  // payments in Morocco since 2017; set to false to hide every crypto mention on the site.
  acceptCrypto: true,

  // Where crypto payments are sent. After a crypto booking, the site shows the address of the
  // coin the client picks, with a copy button and a QR code. Only coins with an address appear.
  // Paste each address exactly as your wallet shows it, and double-check the network: a coin sent
  // on the wrong network is lost.
  // TESTING: these are deliberate non-addresses (wallets reject them). Replace before real customers pay.
  cryptoWallets: [
    { coin: 'USDT', network: 'TRC-20 (Tron)', address: 'TEST-USDT-ADDRESS-NOT-REAL',  rateId: 'tether',   decimals: 2 },
    { coin: 'BTC',  network: 'Bitcoin',       address: 'TEST-BTC-ADDRESS-NOT-REAL',  rateId: 'bitcoin',  decimals: 6 },
    { coin: 'ETH',  network: 'Ethereum (ERC-20)', address: 'TEST-ETH-ADDRESS-NOT-REAL',  rateId: 'ethereum', decimals: 5 },
  ],

  // Real Google reviews only, copied with the reviewer's name as shown on Google (audit 4.3).
  // { name: 'Karim B.', rating: 5, text: '…', date: '2026-08' }
  reviews: [],
  reviewsUrl: null,       // link to the Google Business profile's reviews
};

/* Reservations back end (Supabase). Both values are public by design: the database's security
   rules only let visitors submit a request, never read one. Find them in the Supabase dashboard,
   Project Settings → API ("Project URL" and the "anon public" key). While null, the booking form
   hands requests to WhatsApp instead. */
export const SUPABASE = {
  url: 'https://oacqrhcjvycijrcuukhd.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3FyaGNqdnljaWpyY3V1a2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NTMwNTAsImV4cCI6MjEwNjAyOTA1MH0.z8nx99DC-WetWT4hD7rMphqDzNlRzr9irK7E1GlhzgQ',
  // Email alert per new request (supabase/functions/notify-reservation, needs a Resend key).
  // Off for now: new requests show up live in the panel instead.
  emailAlerts: false,
  // Staff app notifications: the public half of the push key pair (the private half is a Supabase
  // secret). Public by design.
  vapidPublicKey: 'BManH2cetOp-fBIdYjaOdU6k8q6jbc1FwqRmAKQ2kczWmmFOv9ey3EC5_OZ1BkIPC08A3WDOvTgL5akz-OVLz4M',
};

/* The fleet, mirroring rentle.store/carsw6/shop. Prices are the shop's "from" daily rates.
   featured: shown in the pinned showroom (tablet/desktop) and first in the grid.
   tags: the shop's categories — lux (Luxe), suv (SUV), city (Citadine) — used by the grid filter.
   Images come from tools/cutout.py: <img.q> is the front three-quarter view every car rests on;
   <img.side> (only some cars) is shown on the booking summary, which falls back to img.q.
   len = real length in metres, used to size the photo against the floor.
   power/accel/seats: manufacturer figures for the usual version of each model — confirm with the fleet.
   deposit: PLACEHOLDER by tier (citadine 5 000, compact/SUV 10 000, premium 20 000, high 30 000,
   exotic 50 000) except Range Rover Sport and CLA 45 S, which keep their earlier figures. */
const car = (make, model, price, deposit, power, accel, seats, len, q, tags, the, alt, pitch, extra = {}) =>
  ({ make, model, price, deposit, power, accel, seats, len, img: { q, ...(extra.side ? { side: extra.side } : {}) }, tags, the, alt, pitch, featured: !!extra.featured });

export const CARS = [
  car('Mercedes-AMG', 'G 63', 9900, 50000, 585, 4.4, 5, 4.87, 'mercedes-g63-34', ['lux', 'suv'],
    { fr: 'la Mercedes-AMG G 63', en: 'the Mercedes-AMG G 63', ar: 'مرسيدس-AMG G 63' },
    { fr: 'Mercedes-AMG G 63 noire', en: 'Black Mercedes-AMG G 63', ar: 'مرسيدس-AMG G 63 سوداء' },
    { fr: 'Le Classe G, V8 biturbo de 585 ch. La voiture qu\'on remarque devant n\'importe quel hôtel.',
      en: 'The G-Class with a 585 hp twin-turbo V8. The car everyone notices outside any hotel.',
      ar: 'الفئة G بمحرك V8 مزدوج التوربو بقوة 585 حصاناً. السيارة التي تلفت الأنظار أمام أي فندق.' }, { featured: true }),
  car('Lamborghini', 'Urus', 30000, 50000, 666, 3.5, 5, 5.12, 'lamborghini-urus-34', ['lux'],
    { fr: 'la Lamborghini Urus', en: 'the Lamborghini Urus', ar: 'لامبورغيني أوروس' },
    { fr: 'Lamborghini Urus noire', en: 'Black Lamborghini Urus', ar: 'لامبورغيني أوروس سوداء' },
    { fr: '666 ch et 3,5 s de 0 à 100. Une supercar qui emmène cinq personnes et leurs bagages.',
      en: '666 hp and 0–100 in 3.5 s. A supercar that takes five people and their luggage.',
      ar: '666 حصاناً ومن 0 إلى 100 في 3.5 ثوانٍ. سيارة خارقة تتسع لخمسة أشخاص وأمتعتهم.' }, { featured: true }),
  car('Bentley', 'Bentayga', 30000, 50000, 550, 4.5, 5, 5.13, 'bentley-bentayga-34', ['lux', 'suv'],
    { fr: 'la Bentley Bentayga', en: 'the Bentley Bentayga', ar: 'بنتلي بينتايغا' },
    { fr: 'Bentley Bentayga noire', en: 'Black Bentley Bentayga', ar: 'بنتلي بينتايغا سوداء' },
    { fr: 'Cuir cousu main et V8 de 550 ch. Le salon anglais, du Mohammed V jusqu\'à la villa.',
      en: 'Hand-stitched leather and a 550 hp V8. An English drawing room from the airport to the villa.',
      ar: 'جلد مخيط يدوياً ومحرك V8 بقوة 550 حصاناً. صالون إنجليزي من المطار إلى الفيلا.' }, { featured: true }),
  car('Range Rover', 'Vogue', 5990, 30000, 400, 5.9, 5, 5.05, 'range-rover-vogue-34', ['lux', 'suv'],
    { fr: 'la Range Rover Vogue', en: 'the Range Rover Vogue', ar: 'رينج روفر فوغ' },
    { fr: 'Range Rover Vogue noire', en: 'Black Range Rover Vogue', ar: 'رينج روفر فوغ سوداء' },
    { fr: 'Le grand Range Rover. Silence à 130 km/h, sièges massants, place pour toute la famille.',
      en: 'The full-size Range Rover. Silent at 130 km/h, massage seats, room for the whole family.',
      ar: 'رينج روفر الكبيرة. هدوء تام على سرعة 130 كم/س، مقاعد بالتدليك ومكان لكل العائلة.' }, { featured: true }),
  car('Porsche', 'Panamera 4', 7490, 30000, 353, 5.1, 4, 5.05, 'porsche-panamera-34', ['lux'],
    { fr: 'la Porsche Panamera 4', en: 'the Porsche Panamera 4', ar: 'بورشه باناميرا 4' },
    { fr: 'Porsche Panamera 4 noire', en: 'Black Porsche Panamera 4', ar: 'بورشه باناميرا 4 سوداء' },
    { fr: 'Une sportive à quatre portes. Quatre vraies places et la tenue de route d\'une 911.',
      en: 'A four-door sports car. Four proper seats and the road manners of a 911.',
      ar: 'سيارة رياضية بأربعة أبواب. أربعة مقاعد حقيقية وثبات على الطريق يذكّر بالـ911.' }),
  car('Porsche', 'Macan GTS', 5490, 30000, 440, 4.5, 5, 4.73, 'porsche-macan-gts-34', ['lux', 'suv'],
    { fr: 'la Porsche Macan GTS', en: 'the Porsche Macan GTS', ar: 'بورشه ماكان GTS' },
    { fr: 'Porsche Macan GTS noire', en: 'Black Porsche Macan GTS', ar: 'بورشه ماكان GTS سوداء' },
    { fr: 'Le Macan le plus vif : 440 ch, châssis abaissé, freins rouges. Un SUV qui se conduit comme une sportive.',
      en: 'The sharpest Macan: 440 hp, lowered chassis, red calipers. An SUV that drives like a sports car.',
      ar: 'أقوى ماكان: 440 حصاناً وهيكل منخفض ومكابح حمراء. سيارة SUV تُقاد كسيارة رياضية.' }),
  car('Range Rover', 'Sport', 3990, 30000, 400, 5.9, 5, 4.95, 'range-rover-sport-34', ['suv'],
    { fr: 'la Range Rover Sport', en: 'the Range Rover Sport', ar: 'رينج روفر سبورت' },
    { fr: 'Range Rover Sport noire', en: 'Black Range Rover Sport', ar: 'رينج روفر سبورت سوداء' },
    { fr: 'Le confort d\'un salon, la garde au sol pour l\'Atlas. Cinq places, bagages compris.',
      en: 'Lounge-grade comfort, the ground clearance for the Atlas. Five seats, luggage included.',
      ar: 'راحة صالون وارتفاع كافٍ عن الأرض لطرق الأطلس. خمسة مقاعد مع الأمتعة.' }, { side: 'range-rover-sport-side' }),
  car('Mercedes-AMG', 'CLA 45 S', 3490, 25000, 421, 4.0, 5, 4.69, 'amg-cla45-34', ['lux'],
    { fr: 'la Mercedes-AMG CLA 45 S', en: 'the Mercedes-AMG CLA 45 S', ar: 'مرسيدس-AMG CLA 45 S' },
    { fr: 'Mercedes-AMG CLA 45 S noire', en: 'Black Mercedes-AMG CLA 45 S', ar: 'مرسيدس-AMG CLA 45 S سوداء' },
    { fr: '421 ch sous un capot de berline. Discrète en ville, vive sur l\'autoroute de Rabat.',
      en: '421 hp under a saloon\'s bonnet. Discreet in town, quick on the Rabat motorway.',
      ar: '421 حصاناً تحت غطاء سيارة سيدان. هادئة في المدينة وسريعة على الطريق السيار نحو الرباط.' }, { side: 'amg-cla45-side' }),
  car('Porsche', 'Macan S', 3490, 20000, 380, 4.8, 5, 4.73, 'porsche-macan-34', ['lux', 'suv'],
    { fr: 'la Porsche Macan S', en: 'the Porsche Macan S', ar: 'بورشه ماكان S' },
    { fr: 'Porsche Macan S noire', en: 'Black Porsche Macan S', ar: 'بورشه ماكان S سوداء' },
    { fr: 'V6 biturbo de 380 ch. Assez de souffle pour doubler sereinement sur la route de Marrakech.',
      en: 'A 380 hp twin-turbo V6. Plenty in reserve for overtaking on the Marrakech road.',
      ar: 'محرك V6 مزدوج التوربو بقوة 380 حصاناً. قوة كافية للتجاوز بثقة على طريق مراكش.' }),
  car('Mercedes-AMG', 'CLA 35', 2990, 20000, 306, 4.9, 5, 4.69, 'amg-cla35-34', ['lux'],
    { fr: 'la Mercedes-AMG CLA 35', en: 'the Mercedes-AMG CLA 35', ar: 'مرسيدس-AMG CLA 35' },
    { fr: 'Mercedes-AMG CLA 35 grise', en: 'Grey Mercedes-AMG CLA 35', ar: 'مرسيدس-AMG CLA 35 رمادية' },
    { fr: 'Le coupé quatre portes en version AMG : 306 ch et transmission intégrale.',
      en: 'The four-door coupé in AMG form: 306 hp and all-wheel drive.',
      ar: 'الكوبيه ذات الأبواب الأربعة بنسخة AMG: 306 أحصنة ودفع رباعي.' }),
  car('Porsche', 'Macan', 2590, 20000, 265, 6.4, 5, 4.73, 'porsche-macan-34', ['lux', 'suv'],
    { fr: 'la Porsche Macan', en: 'the Porsche Macan', ar: 'بورشه ماكان' },
    { fr: 'Porsche Macan noire', en: 'Black Porsche Macan', ar: 'بورشه ماكان سوداء' },
    { fr: 'Le SUV compact de Porsche. Facile à garer à Casablanca, précis sur la corniche.',
      en: 'Porsche\'s compact SUV. Easy to park in Casablanca, precise along the Corniche.',
      ar: 'سيارة SUV المدمجة من بورشه. سهلة الركن في الدار البيضاء ودقيقة على الكورنيش.' }),
  car('Audi', 'Q8', 2590, 20000, 286, 6.3, 5, 5.0, 'audi-q8-34', ['lux', 'suv'],
    { fr: 'l\'Audi Q8', en: 'the Audi Q8', ar: 'أودي Q8' },
    { fr: 'Audi Q8 noire', en: 'Black Audi Q8', ar: 'أودي Q8 سوداء' },
    { fr: 'Le grand SUV coupé d\'Audi. Cinq mètres de cuir et de silence pour les longs trajets.',
      en: 'Audi\'s large coupé-SUV. Five metres of leather and quiet for long drives.',
      ar: 'سيارة SUV كوبيه الكبيرة من أودي. خمسة أمتار من الجلد والهدوء للرحلات الطويلة.' }),
  car('Mercedes-Benz', 'Classe C', 1990, 10000, 204, 7.3, 5, 4.75, 'mercedes-c-34', ['lux'],
    { fr: 'la Mercedes Classe C', en: 'the Mercedes C-Class', ar: 'مرسيدس الفئة C' },
    { fr: 'Mercedes Classe C noire', en: 'Black Mercedes C-Class', ar: 'مرسيدس الفئة C سوداء' },
    { fr: 'La berline d\'affaires par excellence. Sobre, confortable, toujours à sa place.',
      en: 'The business saloon par excellence. Understated, comfortable, right for every occasion.',
      ar: 'سيارة الأعمال بامتياز. أنيقة ومريحة ومناسبة لكل مناسبة.' }),
  car('Volkswagen', 'Touareg R-Line', 1890, 10000, 286, 6.1, 5, 4.88, 'vw-touareg-34', ['lux', 'suv'],
    { fr: 'le Volkswagen Touareg R-Line', en: 'the Volkswagen Touareg R-Line', ar: 'فولكس فاغن طوارق R-Line' },
    { fr: 'Volkswagen Touareg R-Line noir', en: 'Black Volkswagen Touareg R-Line', ar: 'فولكس فاغن طوارق R-Line سوداء' },
    { fr: 'Le Touareg en finition sportive : V6 de 286 ch, jantes 21 pouces, intérieur noir.',
      en: 'The Touareg in sporty trim: 286 hp V6, 21-inch wheels, black interior.',
      ar: 'طوارق بتجهيز رياضي: محرك V6 بقوة 286 حصاناً وجنوط 21 بوصة ومقصورة سوداء.' }),
  car('Audi', 'Q3', 1690, 10000, 150, 9.2, 5, 4.5, 'audi-q3-34', ['suv'],
    { fr: 'l\'Audi Q3', en: 'the Audi Q3', ar: 'أودي Q3' },
    { fr: 'Audi Q3 Sportback grise', en: 'Grey Audi Q3 Sportback', ar: 'أودي Q3 سبورتباك رمادية' },
    { fr: 'Un SUV compact et soigné, à l\'aise en ville comme sur l\'autoroute.',
      en: 'A compact, well-finished SUV, at home in town and on the motorway.',
      ar: 'سيارة SUV مدمجة ومتقنة، مريحة في المدينة وعلى الطريق السيار.' }),
  car('Mercedes-Benz', 'CLA', 1590, 10000, 163, 8.2, 5, 4.69, 'mercedes-cla-34', ['lux'],
    { fr: 'la Mercedes CLA', en: 'the Mercedes CLA', ar: 'مرسيدس CLA' },
    { fr: 'Mercedes CLA grise', en: 'Grey Mercedes CLA', ar: 'مرسيدس CLA رمادية' },
    { fr: 'La ligne d\'un coupé, le confort d\'une berline. L\'élégance Mercedes à prix doux.',
      en: 'A coupé\'s lines with a saloon\'s comfort. Mercedes elegance at a gentle price.',
      ar: 'خطوط كوبيه وراحة سيدان. أناقة مرسيدس بسعر معقول.' }),
  car('Range Rover', 'Evoque R-Dynamic', 1490, 10000, 204, 8.4, 5, 4.37, 'range-rover-evoque-34', ['lux', 'suv'],
    { fr: 'la Range Rover Evoque R-Dynamic', en: 'the Range Rover Evoque R-Dynamic', ar: 'رينج روفر إيفوك R-Dynamic' },
    { fr: 'Range Rover Evoque R-Dynamic grise', en: 'Grey Range Rover Evoque R-Dynamic', ar: 'رينج روفر إيفوك R-Dynamic رمادية' },
    { fr: 'Le style Range Rover au format ville. Compacte, haute, très à l\'aise à Casablanca.',
      en: 'Range Rover style in a city size. Compact, high-riding, very much at home in Casablanca.',
      ar: 'أناقة رينج روفر بحجم المدينة. مدمجة ومرتفعة ومريحة جداً في الدار البيضاء.' }),
  car('Mercedes-Benz', 'Classe A', 1390, 10000, 163, 8.2, 5, 4.42, 'mercedes-a-34', ['lux'],
    { fr: 'la Mercedes Classe A', en: 'the Mercedes A-Class', ar: 'مرسيدس الفئة A' },
    { fr: 'Mercedes Classe A noire', en: 'Black Mercedes A-Class', ar: 'مرسيدس الفئة A سوداء' },
    { fr: 'La compacte premium : écrans MBUX, finition AMG Line, parfaite pour la ville.',
      en: 'The premium hatchback: MBUX screens, AMG Line trim, perfect for town.',
      ar: 'السيارة المدمجة الفاخرة: شاشات MBUX وتجهيز AMG Line، مثالية للمدينة.' }),
  car('Audi', 'A3', 1390, 5000, 150, 8.4, 5, 4.34, 'audi-a3-34', ['city'],
    { fr: 'l\'Audi A3', en: 'the Audi A3', ar: 'أودي A3' },
    { fr: 'Audi A3 Sportback noire', en: 'Black Audi A3 Sportback', ar: 'أودي A3 سبورتباك سوداء' },
    { fr: 'Une citadine premium, sobre et bien finie. Idéale pour un séjour en ville.',
      en: 'A premium city car, understated and well built. Ideal for a stay in town.',
      ar: 'سيارة مدينة فاخرة، أنيقة ومتقنة الصنع. مثالية لإقامة في المدينة.' }),
  car('Volkswagen', 'Touareg', 1290, 10000, 231, 7.4, 5, 4.88, 'vw-touareg-34', ['lux', 'suv'],
    { fr: 'le Volkswagen Touareg', en: 'the Volkswagen Touareg', ar: 'فولكس فاغن طوارق' },
    { fr: 'Volkswagen Touareg noir', en: 'Black Volkswagen Touareg', ar: 'فولكس فاغن طوارق سوداء' },
    { fr: 'Un grand SUV confortable et robuste, à l\'aise sur autoroute comme sur piste.',
      en: 'A large, comfortable, sturdy SUV, happy on the motorway or a dirt track.',
      ar: 'سيارة SUV كبيرة ومريحة ومتينة، مناسبة للطريق السيار والمسالك.' }),
  car('Volkswagen', 'Tiguan', 990, 10000, 150, 9.3, 5, 4.51, 'vw-touareg-34', ['lux', 'suv'],
    { fr: 'le Volkswagen Tiguan', en: 'the Volkswagen Tiguan', ar: 'فولكس فاغن تيغوان' },
    { fr: 'Volkswagen Tiguan noir', en: 'Black Volkswagen Tiguan', ar: 'فولكس فاغن تيغوان سوداء' },
    { fr: 'Le SUV familial de Volkswagen : spacieux, économique, facile à vivre.',
      en: 'Volkswagen\'s family SUV: roomy, economical, easy to live with.',
      ar: 'سيارة SUV العائلية من فولكس فاغن: فسيحة واقتصادية وسهلة الاستعمال.' }),
  car('Volkswagen', 'Golf 8', 990, 5000, 150, 8.5, 5, 4.28, 'vw-golf-8-34', ['city'],
    { fr: 'la Volkswagen Golf 8', en: 'the Volkswagen Golf 8', ar: 'فولكس فاغن غولف 8' },
    { fr: 'Volkswagen Golf 8 noire', en: 'Black Volkswagen Golf 8', ar: 'فولكس فاغن غولف 8 سوداء' },
    { fr: 'La référence des compactes. Agile en ville, sereine sur la route.',
      en: 'The benchmark hatchback. Nimble in town, composed on the open road.',
      ar: 'مرجع السيارات المدمجة. رشيقة في المدينة وثابتة على الطريق.' }),
  car('Volkswagen', 'T-Roc', 890, 5000, 150, 8.5, 5, 4.23, 'vw-t-roc-34', ['suv'],
    { fr: 'le Volkswagen T-Roc', en: 'the Volkswagen T-Roc', ar: 'فولكس فاغن T-Roc' },
    { fr: 'Volkswagen T-Roc noir', en: 'Black Volkswagen T-Roc', ar: 'فولكس فاغن T-Roc سوداء' },
    { fr: 'Un petit SUV au look affirmé, pratique et économique au quotidien.',
      en: 'A small SUV with a bold look, practical and economical every day.',
      ar: 'سيارة SUV صغيرة بمظهر جريء، عملية واقتصادية يومياً.' }),
  car('Hyundai', 'Tucson', 790, 5000, 136, 11.8, 5, 4.5, 'hyundai-tucson-34', ['suv'],
    { fr: 'le Hyundai Tucson', en: 'the Hyundai Tucson', ar: 'هيونداي توسان' },
    { fr: 'Hyundai Tucson noir', en: 'Black Hyundai Tucson', ar: 'هيونداي توسان سوداء' },
    { fr: 'Un SUV spacieux et bien équipé, pour la famille et les bagages.',
      en: 'A roomy, well-equipped SUV for the family and the luggage.',
      ar: 'سيارة SUV فسيحة ومجهزة جيداً للعائلة والأمتعة.' }),
  car('Hyundai', 'Accent', 490, 5000, 100, 12.2, 5, 4.39, 'hyundai-accent-34', ['city'],
    { fr: 'la Hyundai Accent', en: 'the Hyundai Accent', ar: 'هيونداي أكسنت' },
    { fr: 'Hyundai Accent noire', en: 'Black Hyundai Accent', ar: 'هيونداي أكسنت سوداء' },
    { fr: 'Une berline simple et fiable, avec un vrai coffre. Le bon choix pour rouler malin.',
      en: 'A simple, reliable saloon with a proper boot. The smart choice for getting around.',
      ar: 'سيارة سيدان بسيطة وموثوقة بصندوق واسع. الخيار الذكي للتنقل.' }),
  car('Renault', 'Clio 5', 350, 5000, 90, 12.2, 5, 4.05, 'renault-clio-5-34', ['city'],
    { fr: 'la Renault Clio 5', en: 'the Renault Clio 5', ar: 'رونو كليو 5' },
    { fr: 'Renault Clio 5 noire', en: 'Black Renault Clio 5', ar: 'رونو كليو 5 سوداء' },
    { fr: 'La citadine facile : se gare partout, consomme peu, parfaite pour la ville.',
      en: 'The easy city car: parks anywhere, sips fuel, perfect for town.',
      ar: 'سيارة المدينة السهلة: تُركن في أي مكان واستهلاكها قليل، مثالية للمدينة.' }),
];

/* Delivery places. fee in MAD; airport shows the flight-number field (audit 4.8). */
export const PLACES = [
  { id: 'airport', fee: 0 },
  { id: 'hotel', fee: 0 },
  { id: 'private', fee: 0 },
  { id: 'rabat', fee: 1500 },
  { id: 'marrakech', fee: 3500 },
];
