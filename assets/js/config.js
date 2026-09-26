/* Everything about the business that the site states as fact lives here.
   A value left at null is not shown on the page, so nothing unconfirmed goes live.
   On localhost, a banner lists whatever is still missing. */

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
  url: null,       // e.g. 'https://abcdefghijklm.supabase.co'
  anonKey: null,
  // Email alert per new request (supabase/functions/notify-reservation, needs a Resend key).
  // Off for now: new requests show up live in the panel instead.
  emailAlerts: false,
};

/* The fleet. Images come from tools/cutout.py: <img.q> is the front three-quarter view every car
   rests on (audit 1.3); <img.side> is shown only on the booking summary.
   len = real length in metres, used to size the photo against the 3D floor. */
export const CARS = [
  {
    make: 'Range Rover', model: 'Sport', price: 6500, deposit: 30000, power: 400, accel: 5.9, seats: 5, len: 4.95,
    img: { q: 'range-rover-sport-34', side: 'range-rover-sport-side' },
    the: { fr: 'la Range Rover Sport', en: 'the Range Rover Sport', ar: 'رينج روفر سبورت' },
    alt: { fr: 'Range Rover Sport noir', en: 'Black Range Rover Sport', ar: 'رينج روفر سبورت سوداء' },
    pitch: {
      fr: 'Le confort d\'un salon, la garde au sol pour l\'Atlas. Cinq places, bagages compris.',
      en: 'Lounge-grade comfort, the ground clearance for the Atlas. Five seats, luggage included.',
      ar: 'راحة صالون وارتفاع كافٍ عن الأرض لطرق الأطلس. خمسة مقاعد مع الأمتعة.',
    },
  },
  {
    make: 'Mercedes-AMG', model: 'CLA 45 S', price: 4500, deposit: 25000, power: 421, accel: 4.0, seats: 5, len: 4.69,
    img: { q: 'amg-cla45-34', side: 'amg-cla45-side' },
    the: { fr: 'la Mercedes-AMG CLA 45 S', en: 'the Mercedes-AMG CLA 45 S', ar: 'مرسيدس-AMG CLA 45 S' },
    alt: { fr: 'Mercedes-AMG CLA 45 S noire', en: 'Black Mercedes-AMG CLA 45 S', ar: 'مرسيدس-AMG CLA 45 S سوداء' },
    pitch: {
      fr: '421 ch sous un capot de berline. Discrète en ville, vive sur l\'autoroute de Rabat.',
      en: '421 hp under a saloon\'s bonnet. Discreet in town, quick on the Rabat motorway.',
      ar: '421 حصاناً تحت غطاء سيارة سيدان. هادئة في المدينة وسريعة على الطريق السيار نحو الرباط.',
    },
  },
  {
    make: 'Audi', model: 'RS 3 Sportback', price: 3500, deposit: 20000, power: 400, accel: 3.8, seats: 5, len: 4.39,
    img: { q: 'audi-rs3-34', side: 'audi-rs3-side' },
    the: { fr: 'l\'Audi RS 3 Sportback', en: 'the Audi RS 3 Sportback', ar: 'أودي RS 3 سبورتباك' },
    alt: { fr: 'Audi RS 3 Sportback noire', en: 'Black Audi RS 3 Sportback', ar: 'أودي RS 3 سبورتباك سوداء' },
    pitch: {
      fr: 'Cinq cylindres, 400 ch. Assez vive pour la route côtière, assez discrète pour le dîner.',
      en: 'Five cylinders, 400 hp. Quick enough for the coast road, discreet enough for dinner.',
      ar: 'خمس أسطوانات و400 حصان. سريعة بما يكفي للطريق الساحلي، وهادئة بما يكفي لعشاء في المدينة.',
    },
  },
];

/* Delivery places. fee in MAD; airport shows the flight-number field (audit 4.8). */
export const PLACES = [
  { id: 'airport', fee: 0 },
  { id: 'hotel', fee: 0 },
  { id: 'private', fee: 0 },
  { id: 'rabat', fee: 1500 },
  { id: 'marrakech', fee: 3500 },
];
