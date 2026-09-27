import { BUSINESS, CARS, PLACES, SUPABASE } from './config.js?v=8df0036235';
import { LANGS, STRINGS } from './i18n.js?v=cfa3cf9653';
import META from './cars-meta.js?v=30510c7a1a';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;
const params = new URLSearchParams(location.search);
// ?still renders the settled state without animation (screenshots, hidden tabs)
const still = params.has('still');
const reduce = still || matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still) root.classList.add('still');
const nextFrame = still ? f => setTimeout(() => f(performance.now()), 60) : requestAnimationFrame;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

/* ================= Language ================= */
let lang = [params.get('lang'), store.get('lang')].find(l => l in LANGS) || 'fr';
const t = (key, p = {}) => { const v = STRINGS[lang][key] ?? STRINGS.fr[key]; return typeof v === 'function' ? v(p) : v; };
const fmt = n => new Intl.NumberFormat(LANGS[lang].locale).format(n);
const fmt1 = n => new Intl.NumberFormat(LANGS[lang].locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
const money = n => `${fmt(n)} ${t('currency')}`;
const isRTL = () => LANGS[lang].dir === 'rtl';
// strings whose text depends on business settings
// crypto is offered only when it's switched on and at least one wallet address is filled in
const WALLETS = (BUSINESS.cryptoWallets ?? []).filter(w => w.address);
const cryptoOn = () => BUSINESS.acceptCrypto && WALLETS.length > 0;
const I18N_PARAMS = {
  'process.2.p': () => ({ crypto: cryptoOn() }),
  'pay.intro': () => ({ crypto: cryptoOn() }),
  'f.reassure': () => ({ crypto: cryptoOn() && document.querySelector('#bookForm [name=pay]:checked')?.value === 'crypto' }),
  'pay.deposit.p': () => ({ hours: BUSINESS.depositReleaseHours }),
};

function applyLang() {
  root.lang = lang;
  root.dir = LANGS[lang].dir;
  if (lang === 'ar' && !$('#ar-fonts')) {
    const l = Object.assign(document.createElement('link'), { id: 'ar-fonts', rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Noto+Naskh+Arabic:wght@400;500&display=swap' });
    document.head.appendChild(l);
  }
  document.title = t('meta.title');
  $('meta[name="description"]').content = t('meta.description');
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n, I18N_PARAMS[el.dataset.i18n]?.()); });
  $$('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, key] = pair.split(':'); el.setAttribute(attr, t(key));
  }));
  $$('.langs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  buildFleet();
  buildForm();
  renderBusiness();
  bind(current, false);
}
$$('.langs button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.lang === lang) return;
  lang = b.dataset.lang; store.set('lang', lang);
  applyLang();
}));

/* ================= Images ================= */
const WIDTHS = [800, 1200, 1600];
const srcset = (key, ext) => WIDTHS.map(w => `assets/cars/${key}-${w}.${ext} ${w}w`).join(', ');
const altFor = (c, view) => `${c.alt[lang]}, ${t(view === 'side' ? 'view.side' : 'view.q')}`;
function picture(c, view, sizes, extra = '') {
  const key = c.img[view];
  return `<picture><source type="image/avif" srcset="${srcset(key, 'avif')}" sizes="${sizes}">` +
    `<img src="assets/cars/${key}-800.webp" srcset="${srcset(key, 'webp')}" sizes="${sizes}" alt="${altFor(c, view)}" decoding="async" ${extra}></picture>`;
}

/* ================= Fleet markup ================= */
const roster = $('#roster'), tabs = $('#fleetTabs'), cards = $('#fleetCards');
const specsHTML = c => `
  <div><dt>${t('spec.power')}</dt><dd>${fmt(c.power)}<small>${t('unit.hp')}</small></dd></div>
  <div><dt>${t('spec.accel')}</dt><dd>${fmt1(c.accel)}<small>${t('unit.s')}</small></dd></div>
  <div><dt>${t('spec.seats')}</dt><dd>${fmt(c.seats)}</dd></div>
  <div><dt>${t('spec.price')}</dt><dd>${fmt(c.price)}<small>${t('currency')}</small></dd></div>`;

function buildFleet() {
  roster.innerHTML = CARS.map((c, i) =>
    `<li><button type="button" data-i="${i}"><em>${c.make}</em>${c.model}</button></li>`).join('');
  tabs.innerHTML = CARS.map((c, i) =>
    `<li><button type="button" data-i="${i}"><em>${c.make}</em>${c.model}</button></li>`).join('');
  cards.innerHTML = CARS.map((c, i) => `
    <li data-i="${i}">
      <div class="stage-slot" data-car="${i}"></div>
      <h3><span class="eyebrow">${c.make}</span><br>${c.model}</h3>
      <p class="pitch">${c.pitch[lang]}</p>
      <dl class="specs">${specsHTML(c)}</dl>
      <a class="btn" href="#reserver" data-book="${i}">${t('cta.car', { the: c.the[lang] })}</a>
    </li>`).join('');
  stages.build();
}

/* ================= Current car ================= */
// ?car=N opens on a given car (handy for reviewing each car in the hero)
let current = clamp(parseInt(params.get('car'), 10) || 0, 0, CARS.length - 1);
function bind(i, animate = true) {
  const c = CARS[i];
  const vals = {
    make: c.make, model: c.model, price: fmt(c.price), priceCur: money(c.price), perDay: t('perDay'),
    perDayCur: `${t('currency')} ${t('perDay')}`, pitch: c.pitch[lang], cta: t('cta.car', { the: c.the[lang] }),
    count: t('fleet.count', { i: fmt(i + 1), n: fmt(CARS.length) }),
  };
  const apply = () => {
    $$('[data-bind]').forEach(el => { const k = el.dataset.bind; if (k in vals) el.textContent = vals[k]; });
    $('#specs').innerHTML = specsHTML(c);
  };
  const swaps = $$('.fade-swap');
  if (animate && !reduce) {
    swaps.forEach(s => s.classList.add('out'));
    setTimeout(() => { apply(); swaps.forEach(s => s.classList.remove('out')); }, 250);
  } else apply();
  [roster, tabs].forEach(list => $$('button', list).forEach(b => b.setAttribute('aria-current', +b.dataset.i === i)));
  // bring the active tab into the strip — sideways only, so the page itself never jumps
  const tab = tabs.children[i];
  if (tab && tabs.scrollWidth > tabs.clientWidth) {
    const r = tab.getBoundingClientRect(), s = tabs.getBoundingClientRect();
    tabs.scrollBy({ left: (r.left + r.width / 2) - (s.left + s.width / 2), behavior: animate && !reduce ? 'smooth' : 'auto' });
  }
  $('#sideView').innerHTML = picture(c, 'side', '(max-width: 979px) 90vw, 40vw', 'loading="lazy"');
  $('#fCar').value = i;
  stages.show(i);
  updateTotal();
}
function selectCar(i, animate = true) {
  if (i === current) return;
  current = i;
  bind(i, animate);
}

/* ================= Car stage =================
   Every car stands the same way: a soft floor glow, a glowing ring around its wheels, a shadow
   under the body and a darker one at each tyre. The geometry comes from the wheel contact
   points measured in each photo (tools/cutout.py → cars-meta.js), so nothing is tuned per car.
   A slot says where the floor is; the stage puts the centre of the car's footprint there. */
const pct = v => `${(v * 100).toFixed(3)}%`;
const REF_LEN = Math.max(...CARS.map(c => c.len));   // cars keep their real size relative to each other
function stageHTML(c, i, sizes) {
  const m = META[c.img.q], s = m.stage;
  const vars = [`--ar:${m.w}/${m.h}`, `--cx:${pct(s.cx)}`, `--cy:${pct(s.cy)}`, `--rx:${pct(s.rx)}`, `--ry:${pct(s.ry)}`,
    `--cw:${pct(s.cw)}`, `--ch:${pct(s.ch)}`, `--gy:${pct(s.glowY)}`, `--gh:${pct(s.glowH)}`].join(';');
  const contacts = s.contacts.map(([x, y]) => `<i class="cs-contact" style="--x:${pct(x)};--y:${pct(y)}"></i>`).join('');
  return `<div class="car-stage" data-i="${i}" style="${vars}">
    <div class="cs-ground"></div><div class="cs-glow"></div><div class="cs-ring"></div>
    <div class="cs-shadow"></div>${contacts}
    ${picture(c, 'q', sizes, i === 0 ? 'fetchpriority="high"' : 'loading="lazy"')}
  </div>`;
}
// A slot's floor point and how wide its largest car may be
function slotFrame(slot, rel) {
  const r = slot.getBoundingClientRect();
  const x = rel ? 0 : r.left, y = rel ? 0 : r.top;
  return { x: x + r.width / 2, y: y + r.height * .76, span: Math.min(r.width * .9, r.height * 1.3) };
}
function place(stage, f) {
  const c = CARS[+stage.dataset.i], m = META[c.img.q], s = m.stage;
  const w = f.span * (c.len / REF_LEN) / (m.carRight - m.carLeft), h = w * m.h / m.w;
  stage.style.width = `${w}px`;
  stage.style.transform = `translate3d(${f.x - w * s.cx}px, ${f.y - h * s.cy}px, 0)`;
  const img = stage.querySelector('img');
  if (Math.abs((+img.dataset.w || 0) - w) > w * .15) {   // keep srcset honest as the car grows/shrinks
    img.dataset.w = w; const sz = `${Math.round(w)}px`;
    img.sizes = sz; stage.querySelector('source').sizes = sz;
  }
}

const layer = $('#stageLayer'), heroSlot = $('#heroSlot'), showSlot = $('#showroomSlot');
const stages = {
  build() {
    // tablet/desktop: one fixed layer that carries the car from the hero into the showroom
    layer.innerHTML = CARS.map((c, i) => stageHTML(c, i, '60vw')).join('');
    // phone: a stage inside the hero and inside each fleet card
    $('#heroPhoneSlot').innerHTML = stageHTML(CARS[0], 0, '92vw');
    $$('.fleet-cards .stage-slot').forEach(slot => { slot.innerHTML = stageHTML(CARS[+slot.dataset.car], +slot.dataset.car, '80vw'); });
    this.show(current);
    this.placeInline();
  },
  show(i) { $$('.car-stage', layer).forEach(st => st.classList.toggle('on', +st.dataset.i === i)); },
  placeInline() {
    $$('.stage-slot').forEach(slot => $$('.car-stage', slot).forEach(st => place(st, slotFrame(slot, true))));
  },
};
new ResizeObserver(() => stages.placeInline()).observe(document.body);

// pointer adds a little depth on desktop
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { pointer.tx = e.clientX / innerWidth * 2 - 1; pointer.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });

/* ================= Modes =================
   phone (<760px): stacked hero, swipeable fleet, stages in the page flow.
   tablet/desktop: pinned showroom, the car travels on a fixed layer from hero to showroom. */
const phoneMQ = matchMedia('(max-width: 759px)');
const immersive = () => !phoneMQ.matches;
const flotte = $('#flotte'), header = $('#top'), vignette = $('.vignette');
const state = { showroom: 0, stageVis: 1 };

function layout() {
  flotte.style.height = immersive() ? `${CARS.length * 100}svh` : '';
  stages.placeInline();
  onScroll();
}
phoneMQ.addEventListener('change', layout);

/* ================= Scroll ================= */
function onScroll() {
  header.classList.toggle('scrolled', scrollY > 40);
  if (!immersive()) return;
  const vh = innerHeight, top = flotte.offsetTop, span = flotte.offsetHeight - vh;
  const p = (scrollY - top) / span;
  state.showroom = clamp(scrollY / Math.max(1, top), 0, 1);
  if (p >= 0 && p <= 1) selectCar(Math.min(CARS.length - 1, Math.floor(p * CARS.length * .9999)));
  // the stage fades out once the showroom has passed
  state.stageVis = clamp(1 - (scrollY - (top + span)) / (vh * .6), 0, 1);
  layer.style.opacity = vignette.style.opacity = state.stageVis;
}
addEventListener('scroll', onScroll, { passive: true });

roster.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const i = +b.dataset.i, span = flotte.offsetHeight - innerHeight;
  selectCar(i);
  scrollTo({ top: flotte.offsetTop + span * (i + .5) / CARS.length, behavior: reduce ? 'auto' : 'smooth' });
});

// phone carousel: swiping picks the car; tabs scroll the carousel
let cardTick = 0;
cards.addEventListener('scroll', () => {
  cancelAnimationFrame(cardTick);
  cardTick = requestAnimationFrame(() => {
    const mid = cards.getBoundingClientRect().left + cards.clientWidth / 2;
    let best = 0, bestD = Infinity;
    [...cards.children].forEach((li, i) => {
      const r = li.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    selectCar(best);
  });
}, { passive: true });
tabs.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const i = +b.dataset.i;
  selectCar(i);
  cards.children[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
});
// a car's own button books that car
document.addEventListener('click', e => {
  const a = e.target.closest('[data-book]');
  if (a && a.dataset.book !== '') selectCar(+a.dataset.book, false);
});

/* ================= Layer loop (tablet/desktop only) =================
   Between the hero and the pinned showroom the car glides from one slot to the other. */
function frame() {
  nextFrame(frame);
  if (!immersive() || state.stageVis <= 0) return;
  if (!reduce) { pointer.x += (pointer.tx - pointer.x) * .06; pointer.y += (pointer.ty - pointer.y) * .06; }
  const a = slotFrame(heroSlot), b = slotFrame(showSlot), t = state.showroom;
  const e = t * t * (3 - 2 * t);
  const f = { x: lerp(a.x, b.x, e) + pointer.x * 10, y: lerp(a.y, b.y, e) + pointer.y * 5, span: lerp(a.span, b.span, e) };
  $$('.car-stage', layer).forEach(st => place(st, f));
}

/* ================= Booking form ================= */
const form = $('#bookForm'), fCar = $('#fCar'), fPlace = $('#fPlace'), fStart = $('#fStart'), fEnd = $('#fEnd');
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = new Date();
fStart.min = iso(today); fStart.value = iso(addDays(today, 1)); fEnd.value = iso(addDays(today, 4));

function buildForm() {
  const car = fCar.value || current, place = fPlace.value || 'airport';
  fCar.innerHTML = CARS.map((c, i) => `<option value="${i}">${c.make} ${c.model} — ${money(c.price)} ${t('perDay')}</option>`).join('');
  fPlace.innerHTML = PLACES.map(p => `<option value="${p.id}">${t(`place.${p.id}`)}${p.fee ? ` (+${money(p.fee)})` : ''}</option>`).join('');
  fCar.value = car; fPlace.value = place;
  $('#payField').hidden = !cryptoOn();
  $('#payCrypto').hidden = !cryptoOn();
  $('#payCryptoCoins').innerHTML = WALLETS.map(w => `<li>${w.coin} (${w.network})</li>`).join('');
  $('#payChoiceCrypto').textContent = WALLETS.map(w => w.coin).join(', ');
  // homepage: the coins accepted, right under the headline
  $('#heroCrypto').innerHTML = cryptoOn() ? WALLETS.map(w => `<span class="chip coin">${w.coin}</span>`).join('') : '';
  syncPlace();
}
const days = () => {
  if (!fStart.value || !fEnd.value) return 0;
  const d = Math.round((parse(fEnd.value) - parse(fStart.value)) / 864e5);
  return d > 0 ? d : 0;
};
const placeFee = () => PLACES.find(p => p.id === fPlace.value)?.fee ?? 0;
function updateTotal() {
  const c = CARS[current], d = days(), fee = placeFee(), total = d ? money(d * c.price + fee) : '—';
  const rows = [
    [t('sum.rate'), money(c.price)],
    [t('sum.days'), d ? t('days', d) : '—'],
    [t('sum.delivery'), fee ? money(fee) : t('sum.free')],
    [t('sum.deposit', { hours: BUSINESS.depositReleaseHours }), money(c.deposit)],
  ];
  const html = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('') +
    `<tr class="total"><td>${t('sum.total')}</td><td>${total}</td></tr>`;
  $$('[data-summary]').forEach(tb => { tb.innerHTML = html; });
  $$('[data-bind="total"]').forEach(el => { el.textContent = total; });
  const ins = $('[data-bind="insurance"]');
  ins.hidden = BUSINESS.insuranceExcess == null;
  if (!ins.hidden) ins.textContent = t('sum.insurance', { excess: fmt(BUSINESS.insuranceExcess) });
}
function syncPlace() { $('#flightField').hidden = fPlace.value !== 'airport'; updateTotal(); }

fCar.addEventListener('change', () => selectCar(+fCar.value));
fPlace.addEventListener('change', syncPlace);
[fStart, fEnd].forEach(el => el.addEventListener('change', () => {
  if (el === fStart && fStart.value && (!fEnd.value || fEnd.value <= fStart.value)) fEnd.value = iso(addDays(parse(fStart.value), 1));
  fEnd.min = fStart.value ? iso(addDays(parse(fStart.value), 1)) : '';
  updateTotal();
}));

// our own messages, in the page's language, instead of the browser's (audit 3.5)
const errBox = $('#formErr');
function invalid(el, msg) {
  el.setCustomValidity(msg); el.setAttribute('aria-invalid', 'true');
  errBox.textContent = msg; el.reportValidity(); el.focus();
  return false;
}
$$('input', form).forEach(el => el.addEventListener('input', () => {
  el.setCustomValidity(''); el.removeAttribute('aria-invalid'); errBox.textContent = '';
}));
function validate() {
  if (!fStart.value || fStart.value < iso(today)) return invalid(fStart, t('err.past'));
  if (!days()) return invalid(fEnd, t('err.dates'));
  if (!form.name.value.trim()) return invalid(form.name, t('err.name'));
  if (form.phone.value.replace(/\D/g, '').length < 8) return invalid(form.phone, t('err.phone'));
  return true;
}

const waUrl = text => `https://wa.me/${BUSINESS.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
form.addEventListener('submit', async e => {
  e.preventDefault();
  errBox.textContent = '';
  if (!validate()) return;
  const c = CARS[current], d = days();
  const dateFmt = s => parse(s).toLocaleDateString(LANGS[lang].locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const place = PLACES.find(p => p.id === fPlace.value);
  const request = {
    car: `${c.make} ${c.model}`, start: fStart.value, startTime: form.startTime.value, end: fEnd.value, endTime: form.endTime.value,
    place: place.id, flight: place.id === 'airport' ? form.flight.value.trim() : '', payment: cryptoOn() ? form.pay.value : 'bank',
    name: form.name.value.trim(), phone: form.phone.value.trim(), days: d, estimate: d * c.price + place.fee, lang,
  };
  const msg = t('wa.msg', {
    car: c.the[lang], d1: dateFmt(request.start), t1: request.startTime, d2: dateFmt(request.end), t2: request.endTime,
    place: t(`place.${place.id}`), flight: request.flight, pay: t(request.payment === 'crypto' ? 'f.crypto' : 'f.bank'),
    name: request.name, phone: request.phone, total: money(request.estimate),
  });
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  try {
    if (SUPABASE.url && SUPABASE.anonKey) {
      // saved in the reservations database; success is only shown once it's really stored
      const ref = await submitReservation(request);
      const car = `${c.make} ${c.model}`;
      if (request.payment === 'crypto') {
        showCryptoPay(ref, request.estimate);   // pay now: our address, the amount, copy and QR
      } else {
        const follow = BUSINESS.whatsapp ? waUrl(`${msg}\n${t('sent.refLine', { ref })}`) : null;
        done(t('sent.h'), t('sent.p', { car, d1: dateFmt(request.start), d2: dateFmt(request.end), ref }), follow);
      }
    } else if (BUSINESS.whatsapp) {
      // no back office yet: hand the request to WhatsApp; the visitor presses Send there
      const url = waUrl(msg);
      window.open(url, '_blank', 'noopener');
      done(t('wa.h'), t('wa.p'), url);
    } else {
      errBox.textContent = t('err.noChannel');
    }
  } catch (err) {
    if (err.message === 'rate_limited') { errBox.textContent = t('err.rate'); return; }
    if (err.message === 'start_in_past') { errBox.textContent = t('err.past'); return; }
    errBox.textContent = t('err.send', { number: BUSINESS.whatsappDisplay });
    if (BUSINESS.whatsapp) errBox.insertAdjacentHTML('beforeend', ` <a href="${waUrl(msg)}" target="_blank" rel="noopener">${t('wa.open')}</a>`);
  } finally {
    btn.disabled = false;
  }
});
async function submitReservation(r) {
  const headers = { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${SUPABASE.url}/rest/v1/rpc/submit_reservation`, {
    method: 'POST', headers,
    body: JSON.stringify({
      p_car: r.car, p_start: r.start, p_start_time: r.startTime || '10:00', p_end: r.end, p_end_time: r.endTime || '10:00',
      p_place: r.place, p_flight: r.flight || null, p_payment: r.payment, p_name: r.name, p_phone: r.phone,
      p_lang: r.lang, p_days: r.days, p_estimate: r.estimate, p_website: form.website.value,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || `http_${res.status}`);
  // tell the team by email (when switched on); fire-and-forget so the visitor never waits on it
  if (SUPABASE.emailAlerts) fetch(`${SUPABASE.url}/functions/v1/notify-reservation`, {
    method: 'POST', headers, body: JSON.stringify({ ref: body }), keepalive: true,
  }).catch(() => {});
  return body;
}
/* ================= Paying in crypto =================
   After a crypto booking the client sees our wallet for the coin they pick: the amount at the current
   rate, the address with a copy button, a QR code for phone wallets, and which network to use. */
let rates = null;
async function loadRates() {
  if (rates) return rates;
  try {
    const ids = [...new Set(WALLETS.map(w => w.rateId))].join(',');
    const [fx, px] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/MAD').then(r => r.json()),
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`).then(r => r.json()),
    ]);
    const usdPerMad = fx?.rates?.USD;
    if (!usdPerMad) throw new Error('no fx');
    rates = Object.fromEntries(WALLETS.map(w => [w.coin, px?.[w.rateId]?.usd ? usdPerMad / px[w.rateId].usd : null]));
  } catch { rates = {}; }
  return rates;
}
let qrLib = null;
async function qrSvg(text) {
  try {
    qrLib ??= (await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm')).default;
    const q = qrLib(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch { return ''; }
}
async function showCryptoPay(ref, estimate) {
  const box = $('#cryptoPay');
  $('#cpTitle').textContent = t('cpay.h', { ref });
  $('#cpLead').textContent = t('cpay.lead', { amount: money(estimate) });
  $('#cpKeep').textContent = t('cpay.keep', { ref });
  $('#cpCoins').innerHTML = WALLETS.map((w, i) =>
    `<button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}">${w.coin}</button>`).join('');
  form.hidden = true; $('#doneMsg').hidden = true; box.hidden = false;
  box.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  const r = await loadRates();
  const pick = async i => {
    const w = WALLETS[i], rate = r[w.coin];
    $$('#cpCoins button').forEach(b => b.setAttribute('aria-selected', +b.dataset.i === i));
    const amount = rate ? (estimate * rate).toFixed(w.decimals) : null;
    $('#cpAmount').textContent = amount ? `${amount} ${w.coin}` : money(estimate);
    $('#cpApprox').textContent = amount ? t('cpay.approx', { mad: money(estimate) }) : t('cpay.norate');
    $('#cpCopyAmount').hidden = !amount;
    $('#cpCopyAmount').dataset.copy = amount ?? '';
    $('#cpAddrLabel').textContent = t('cpay.address', { coin: w.coin, network: w.network });
    $('#cpAddr').textContent = w.address;
    $('#cpCopyAddr').dataset.copy = w.address;
    $('#cpWarn').textContent = t('cpay.warn', { coin: w.coin, network: w.network });
    $('#cpQr').innerHTML = await qrSvg(w.address);
  };
  $('#cpCoins').onclick = e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
  pick(0);
}
$('#cryptoPay').addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if (!b || !b.dataset.copy) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch { return; }
  const label = b.textContent; b.textContent = t('cpay.copied');
  setTimeout(() => { b.textContent = label; }, 1600);
});
// the note under the button follows the payment choice
form.addEventListener('change', e => {
  if (e.target.name === 'pay') $('[data-i18n="f.reassure"]').textContent = t('f.reassure', I18N_PARAMS['f.reassure']());
});

function done(title, text, link) {
  $('#doneTitle').textContent = title; $('#doneText').textContent = text;
  const a = $('#doneLink'); a.hidden = !link;
  if (link) { a.href = link; a.textContent = t('wa.open'); }
  form.hidden = true; $('#doneMsg').hidden = false; $('#doneMsg').focus();
}

/* ================= Business details (footer, reviews, requirements) ================= */
function renderBusiness() {
  const B = BUSINESS;
  const show = (sel, text) => { const el = $(sel); el.hidden = !text; if (text) el.textContent = text; };
  show('[data-bind="legalName"]', B.legalName);
  show('[data-bind="legalIds"]', [B.rc && `RC ${B.rc}`, B.ice && `ICE ${B.ice}`, B.if && `IF ${B.if}`].filter(Boolean).join(', '));
  show('[data-bind="address"]', B.address);
  $$('.wa-link').forEach(a => { a.href = B.whatsapp ? waUrl() : '#'; });
  $('#footWa').hidden = $('#waFloat').hidden = !B.whatsapp;
  if (B.whatsapp) $('#footWa a').textContent = `WhatsApp ${B.whatsappDisplay || `+${B.whatsapp}`}`;
  const req = $('#requirements');
  req.hidden = !(B.minAge && B.licenseYears);
  if (!req.hidden) req.textContent = t('process.req', { age: fmt(B.minAge), years: fmt(B.licenseYears) });
  // real reviews only; the section stays hidden until there are some
  $('#avis').hidden = !B.reviews.length;
  $('#reviewList').innerHTML = B.reviews.map(r => `
    <li><div class="stars" role="img" aria-label="${t('reviews.stars', { n: r.rating })}">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
    <blockquote>${r.text.replace(/</g, '&lt;')}</blockquote><footer>${r.name.replace(/</g, '&lt;')}${r.date ? `, ${r.date}` : ''}</footer></li>`).join('');
  const all = $('#reviewsAll'); all.hidden = !B.reviewsUrl; if (B.reviewsUrl) all.href = B.reviewsUrl;
}

// phone booking bar steps aside once the form is on screen
new IntersectionObserver(([e]) => $('#bookbar').classList.toggle('away', e.isIntersecting), { rootMargin: '0px 0px -30% 0px' })
  .observe($('#reserver'));

// on localhost, list the business facts still missing from config.js
if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !still) {
  const missing = Object.entries(BUSINESS).filter(([k, v]) => v === null && k !== 'reviewsUrl').map(([k]) => k);
  if (!SUPABASE.url || !SUPABASE.anonKey) missing.push('SUPABASE (url, anonKey)');
  if (BUSINESS.acceptCrypto && !WALLETS.length) missing.push('cryptoWallets (addresses)');
  if (!BUSINESS.reviews.length) missing.push('reviews');
  let dismissed = false; try { dismissed = sessionStorage.getItem('devBanner') === 'off'; } catch {}
  if (missing.length && !dismissed) {
    const el = Object.assign(document.createElement('div'), { className: 'dev-banner' });
    el.innerHTML = `<button type="button">OK</button>À compléter dans assets/js/config.js avant la mise en ligne : ${missing.join(', ')}`;
    el.querySelector('button').onclick = () => { el.remove(); try { sessionStorage.setItem('devBanner', 'off'); } catch {} };
    document.body.appendChild(el);
  }
}

/* ================= Start ================= */
applyLang();
layout();
nextFrame(frame);
