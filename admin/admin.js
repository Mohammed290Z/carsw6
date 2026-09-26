// CARSW6 reservations panel. Talks to Supabase with the signed-in person's own session: what they
// can see and change is decided by the database's security rules, not by this page.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { BUSINESS, CARS, SUPABASE } from '../assets/js/config.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= Vocabulary ================= */
const STATUS = {
  new: 'Nouvelle', confirmed: 'Confirmée', paid: 'Payée', delivered: 'Livrée', returned: 'Terminée', cancelled: 'Annulée',
};
const ACTIVE = ['confirmed', 'paid', 'delivered'];   // statuses that hold the car
const PAY_STATUS = { unpaid: 'Non payé', awaiting: 'Lien envoyé, en attente', partial: 'Paiement partiel', paid: 'Payé', refunded: 'Remboursé' };
// NOWPayments' own states, as shown in a reservation's payment history
const NP_STATUS = { waiting: 'En attente du client', confirming: 'Paiement détecté, confirmation en cours', confirmed: 'Confirmé sur la blockchain',
  sending: 'Envoi vers votre portefeuille', partially_paid: 'Paiement partiel reçu', finished: 'Payé', failed: 'Échoué', refunded: 'Remboursé', expired: 'Expiré' };
const DEPOSIT = { none: 'Pas de caution', held: 'Caution bloquée', released: 'Caution libérée' };
const PAYMENT = { bank: 'Virement', crypto: 'Crypto' };
const PLACE = { airport: 'Aéroport Mohammed V', hotel: 'Hôtel à Casablanca', private: 'Adresse privée', rabat: 'Rabat', marrakech: 'Marrakech' };
// the obvious next step for each status
const NEXT = {
  new: { to: 'confirmed', label: 'Confirmer' },
  confirmed: { to: 'paid', label: 'Marquer payée', patch: { payment_status: 'paid' } },
  paid: { to: 'delivered', label: 'Marquer livrée', patch: { deposit_status: 'held' } },
  delivered: { to: 'returned', label: 'Marquer restituée' },
};

const fmtDate = (d, opts = { day: 'numeric', month: 'short' }) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', opts);
const fmtDateLong = d => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const fmtStamp = s => new Date(s).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const mad = n => `${Number(n).toLocaleString('fr-FR')} MAD`;
const hm = t => String(t ?? '').slice(0, 5);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const todayISO = () => iso(new Date());

function toast(text, isErr = false) {
  const el = Object.assign(document.createElement('div'), { className: `toast${isErr ? ' err' : ''}`, textContent: text });
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 4200);
}

/* ================= Supabase ================= */
if (!SUPABASE.url || !SUPABASE.anonKey) {
  $('#auth').hidden = false;
  $$('#auth form').forEach(f => { f.hidden = true; });
  $('#setupNote').hidden = false;
  throw new Error('Supabase is not configured in assets/js/config.js');
}
// an invitation or password-reset link lands here with its type in the URL fragment
const arrivedFor = /type=(invite|recovery)/.exec(location.hash)?.[1] ?? null;
const sb = createClient(SUPABASE.url, SUPABASE.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });

let me = null;          // { id, email, role, name }
let all = [];           // reservations, newest first
let team = [];
let filter = { status: 'active', q: '' };
let openId = null;

/* ================= Sign-in screens ================= */
function showAuth(which) {
  $('#app').hidden = true;
  $('#auth').hidden = false;
  ['login', 'forgot', 'password'].forEach(k => { $(`#${k}Form`).hidden = k !== which; });
  $(`#${which}Form input`)?.focus();
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.go)));

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, msg = $('.msg', f);
  msg.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (error) {
    msg.textContent = {
      invalid_credentials: 'E-mail ou mot de passe incorrect.',
      email_not_confirmed: "Ce compte n'est pas encore confirmé. Ouvrez le lien reçu par e-mail, ou confirmez-le dans Supabase.",
      email_provider_disabled: 'La connexion par e-mail est désactivée dans Supabase (Authentication → Providers → Email).',
      over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
    }[error.code] ?? `Connexion impossible : ${error.message}`;
    return;
  }
  f.reset();
  await enter();
});
$('#forgotForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, msg = $('.msg', f);
  const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + location.pathname });
  msg.classList.toggle('ok', !error);
  msg.textContent = error ? "L'envoi a échoué. Réessayez dans quelques minutes." : 'Si ce compte existe, un lien vient de lui être envoyé.';
});
$('#passwordForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, msg = $('.msg', f);
  if (f.password.value !== f.confirm.value) { msg.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
  if (!/(?=.*[A-Za-z])(?=.*\d).{10,}/.test(f.password.value)) { msg.textContent = 'Au moins 10 caractères, avec des lettres et des chiffres.'; return; }
  const { error } = await sb.auth.updateUser({ password: f.password.value });
  if (error) { msg.textContent = `Impossible d'enregistrer : ${error.message}`; return; }
  history.replaceState(null, '', location.pathname);
  await enter();
});
$('#signOut').addEventListener('click', async () => { await sb.auth.signOut(); location.hash = ''; showAuth('login'); });

sb.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') showAuth('password');
});

/* ================= Entering the panel ================= */
async function enter() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { showAuth('login'); return; }
  let { data: isStaff } = await sb.rpc('is_staff');
  if (!isStaff) {
    // the very first account becomes admin; anyone else without a team entry is turned away
    const { data: claimed } = await sb.rpc('claim_first_admin');
    if (claimed) { isStaff = true; toast('Bienvenue : ce compte est administrateur du panneau.'); }
  }
  if (!isStaff) {
    await sb.auth.signOut();
    showAuth('login');
    $('#loginForm .msg').textContent = "Ce compte n'a pas accès au panneau. Demandez une invitation à l'administrateur.";
    return;
  }
  const { data: row } = await sb.from('staff').select('role,name,email').eq('user_id', user.id).single();
  me = { id: user.id, email: user.email, role: row?.role ?? 'staff', name: row?.name };
  $('#meEmail').textContent = me.email;
  $$('[data-admin]').forEach(el => { el.hidden = me.role !== 'admin'; });
  $('#auth').hidden = true;
  $('#app').hidden = false;
  await Promise.all([loadReservations(), loadTeam()]);
  listen();
  route();
}

/* ================= Data ================= */
async function loadReservations() {
  const { data, error } = await sb.from('reservations').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) { toast(`Chargement impossible : ${error.message}`, true); return; }
  all = data;
  render();
}
async function loadTeam() {
  const { data } = await sb.from('staff').select('*').order('created_at');
  team = data ?? [];
  if (!$('#view-team').hidden) renderTeam();
}
async function save(id, patch, okText) {
  const { error } = await sb.from('reservations').update(patch).eq('id', id);
  if (error) { toast(`Échec : ${error.message}`, true); return false; }
  const r = all.find(x => x.id === id);
  if (r) Object.assign(r, patch);
  if (okText) toast(okText);
  render();
  if (openId === id) openDrawer(id);
  return true;
}

// new requests appear live; a short chime and the tab title point them out
let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  sb.channel('reservations').on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
    if (payload.eventType === 'INSERT') {
      all.unshift(payload.new);
      toast(`Nouvelle demande ${payload.new.ref} : ${payload.new.name}, ${payload.new.car}`);
      chime();
    } else if (payload.eventType === 'UPDATE') {
      const i = all.findIndex(r => r.id === payload.new.id);
      if (i >= 0) all[i] = payload.new;
    } else if (payload.eventType === 'DELETE') {
      all = all.filter(r => r.id !== payload.old.id);
    }
    render();
    if (openId && payload.new?.id === openId) openDrawer(openId);
  }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, payload => {
    const p = payload.new;
    if (p.status === 'finished') { toast('Paiement crypto reçu.'); chime(); }
    if (openId && p.reservation_id === openId) { const r = all.find(x => x.id === openId); if (r) loadPayments(r); }
  }).subscribe();
}
function chime() {
  try {
    const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .6);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .6);
  } catch { /* sound is a nicety */ }
}

/* ================= Conflicts ================= */
// another reservation holding the same car on overlapping dates
function clashes(r) {
  if (r.status === 'cancelled' || r.status === 'returned') return [];
  return all.filter(o => o.id !== r.id && o.car === r.car && ACTIVE.includes(o.status)
    && o.start_date < r.end_date && r.start_date < o.end_date);
}

/* ================= Reservations list ================= */
const FILTERS = [
  ['active', 'À traiter et en cours', r => ['new', ...ACTIVE].includes(r.status)],
  ['new', 'Nouvelles', r => r.status === 'new'],
  ['confirmed', 'Confirmées', r => r.status === 'confirmed'],
  ['paid', 'Payées', r => r.status === 'paid'],
  ['delivered', 'Livrées', r => r.status === 'delivered'],
  ['returned', 'Terminées', r => r.status === 'returned'],
  ['cancelled', 'Annulées', r => r.status === 'cancelled'],
  ['all', 'Toutes', () => true],
];
function visible() {
  const test = FILTERS.find(f => f[0] === filter.status)[2];
  const q = filter.q.toLowerCase().replace(/\s+/g, '');
  return all.filter(r => test(r) && (!q || `${r.name}${r.phone}${r.ref}${r.car}`.toLowerCase().replace(/\s+/g, '').includes(q)));
}

function render() {
  const today = todayISO(), tomorrow = iso(addDays(new Date(), 1));
  const nNew = all.filter(r => r.status === 'new').length;
  $('#newCount').hidden = !nNew;
  $('#newCount').textContent = nNew;
  document.title = `${nNew ? `(${nNew}) ` : ''}Panneau — CARSW6`;

  const tiles = [
    ['new', 'Nouvelles à traiter', nNew, true],
    ['out', "Départs aujourd'hui et demain", all.filter(r => ['confirmed', 'paid'].includes(r.status) && [today, tomorrow].includes(r.start_date)).length],
    ['back', "Retours aujourd'hui et demain", all.filter(r => r.status === 'delivered' && [today, tomorrow].includes(r.end_date)).length],
    ['delivered', 'Voitures chez un client', all.filter(r => r.status === 'delivered').length],
  ];
  $('#tiles').innerHTML = tiles.map(([k, label, n, hot]) =>
    `<button class="tile${hot && n ? ' hot' : ''}" type="button" data-tile="${k}"><b>${n}</b><span>${label}</span></button>`).join('');

  $('#statusTabs').innerHTML = FILTERS.map(([k, label, test]) =>
    `<button type="button" role="tab" data-filter="${k}" aria-selected="${filter.status === k}">${label}<small>${all.filter(test).length}</small></button>`).join('');

  const rows = visible();
  $('#rows').innerHTML = rows.map(r => {
    const clash = clashes(r).length ? ' <span class="status s-cancelled" title="Chevauche une autre réservation">conflit</span>' : '';
    return `<tr data-id="${r.id}" class="${r.status === 'new' ? 'is-new' : ''}">
      <td data-k="ref" class="ref">${esc(r.ref)}</td>
      <td data-k="received">${fmtStamp(r.created_at)}</td>
      <td data-k="client">${esc(r.name)}<span class="sub">${esc(r.phone)}</span></td>
      <td data-k="car">${esc(r.car)}${clash}</td>
      <td data-k="dates">${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}<span class="sub">${r.days} j</span></td>
      <td data-k="place">${esc(PLACE[r.place] ?? r.place)}${r.flight ? `<span class="sub">vol ${esc(r.flight)}</span>` : ''}</td>
      <td data-k="pay">${PAYMENT[r.payment]}<span class="sub">${PAY_STATUS[r.payment_status]}</span></td>
      <td data-k="estimate" class="num">${mad(r.estimate)}</td>
      <td data-k="status"><span class="status s-${r.status}">${STATUS[r.status]}</span></td>
    </tr>`;
  }).join('');
  $('#empty').hidden = rows.length > 0;
  $('#empty').textContent = all.length ? 'Aucune réservation ne correspond à ce filtre.' : 'Aucune demande pour le moment. Elles apparaîtront ici dès leur envoi depuis le site.';
  if (!$('#view-planning').hidden) renderPlanning();
}

$('#statusTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  filter.status = b.dataset.filter; render();
});
$('#tiles').addEventListener('click', e => {
  const b = e.target.closest('[data-tile]'); if (!b) return;
  const k = b.dataset.tile;
  filter.status = k === 'new' ? 'new' : k === 'delivered' || k === 'back' ? 'delivered' : 'active';
  render();
});
$('#search').addEventListener('input', e => { filter.q = e.target.value; render(); });
$('#rows').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#/r/${tr.dataset.id}`;
});

$('#exportCsv').addEventListener('click', () => {
  const cols = [['ref', 'Réf.'], ['created_at', 'Reçue'], ['status', 'Statut'], ['name', 'Client'], ['phone', 'Téléphone'], ['car', 'Voiture'],
    ['start_date', 'Début'], ['start_time', 'Heure début'], ['end_date', 'Fin'], ['end_time', 'Heure fin'], ['days', 'Jours'],
    ['place', 'Livraison'], ['flight', 'Vol'], ['payment', 'Paiement'], ['payment_status', 'Payé ?'], ['deposit_status', 'Caution'],
    ['estimate', 'Estimé (MAD)'], ['notes', 'Notes']];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.map(c => cell(c[1])).join(';'), ...visible().map(r => cols.map(([k]) => cell(
    k === 'status' ? STATUS[r[k]] : k === 'place' ? PLACE[r[k]] : k === 'payment' ? PAYMENT[r[k]] : r[k])).join(';'))];
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: `reservations-carsw6-${todayISO()}.csv` }).click();
  URL.revokeObjectURL(url);
});

/* ================= Reservation drawer ================= */
const drawer = $('#drawer');
drawer.addEventListener('close', () => { openId = null; if (location.hash.startsWith('#/r/')) history.replaceState(null, '', '#/'); });
drawer.addEventListener('click', e => { if (e.target === drawer) drawer.close(); });

// message to the client in their language, ready to send from WhatsApp
function confirmationText(r) {
  const car = r.car, d1 = fmtDateLong(r.start_date), d2 = fmtDateLong(r.end_date), t1 = hm(r.start_time), t2 = hm(r.end_time);
  const total = mad(r.estimate), place = PLACE[r.place] ?? r.place;
  if (r.lang === 'en') return `Hello ${r.name}, this is CARSW6. Your booking ${r.ref} is confirmed: ${car}, from ${d1} at ${t1} to ${d2} at ${t2}, delivered to ${place}. Estimated total: ${total}. We will send you the invoice for payment.`;
  if (r.lang === 'ar') return `مرحباً ${r.name}، معك CARSW6. تم تأكيد حجزك ${r.ref}: ${car}، من ${d1} الساعة ${t1} إلى ${d2} الساعة ${t2}، مع التوصيل إلى ${place}. المجموع التقديري: ${total}. سنرسل لك الفاتورة للدفع.`;
  return `Bonjour ${r.name}, c'est CARSW6. Votre réservation ${r.ref} est confirmée : ${car}, du ${d1} à ${t1} au ${d2} à ${t2}, livraison ${place}. Total estimé : ${total}. Nous vous envoyons la facture pour le règlement.`;
}
function paymentText(r) {
  const amount = mad(r.payment_amount ?? r.estimate);
  if (r.lang === 'en') return `Hello ${r.name}, here is the link to pay for your booking ${r.ref} (${r.car}) in crypto: ${r.payment_url}\nAmount: ${amount}. You can choose USDT, BTC or ETH on the page.`;
  if (r.lang === 'ar') return `مرحباً ${r.name}، هذا رابط دفع حجزك ${r.ref} (${r.car}) بالعملات المشفرة: ${r.payment_url}\nالمبلغ: ${amount}. يمكنك اختيار USDT أو BTC أو ETH في الصفحة.`;
  return `Bonjour ${r.name}, voici le lien pour régler votre réservation ${r.ref} (${r.car}) en crypto : ${r.payment_url}\nMontant : ${amount}. Vous pouvez choisir USDT, BTC ou ETH sur la page.`;
}
const wa = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

async function openDrawer(id) {
  const r = all.find(x => x.id === id);
  if (!r) { toast('Réservation introuvable (supprimée ?)', true); history.replaceState(null, '', '#/'); return; }
  openId = id;
  const next = NEXT[r.status];
  const clash = clashes(r);
  const assignee = team.find(t => t.user_id === r.assigned_to);
  $('#drawerBody').innerHTML = `
    <div class="d-head">
      <div>
        <p class="ref">Réf. ${esc(r.ref)} · reçue le ${fmtStamp(r.created_at)}</p>
        <h2 id="dTitle">${esc(r.name)}</h2>
        <span class="status s-${r.status}">${STATUS[r.status]}</span>
      </div>
      <button class="btn ghost small close" type="button" data-act="close" aria-label="Fermer">Fermer</button>
    </div>

    ${clash.length ? `<p class="warn">Cette voiture est déjà prise sur ces dates : ${clash.map(o => `<a href="#/r/${o.id}">${esc(o.ref)}</a> (${STATUS[o.status]}, ${fmtDate(o.start_date)} → ${fmtDate(o.end_date)})`).join(', ')}.</p>` : ''}

    <div class="d-actions">
      ${next ? `<button class="btn primary" type="button" data-act="next">${next.label}</button>` : ''}
      ${!['cancelled', 'returned'].includes(r.status) ? '<button class="btn danger" type="button" data-act="cancel">Annuler la réservation</button>' : ''}
      ${r.status === 'cancelled' ? '<button class="btn" type="button" data-act="reopen">Rouvrir</button>' : ''}
    </div>

    <div class="section">
      <h3>Client</h3>
      <dl class="kv"><dt>Nom</dt><dd>${esc(r.name)}</dd><dt>WhatsApp</dt><dd>${esc(r.phone)}</dd><dt>Langue</dt><dd>${r.lang.toUpperCase()}</dd></dl>
      <div class="contact" style="margin-top:12px">
        <a class="btn small" href="${wa(r.phone)}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
        <a class="btn small" href="${wa(r.phone, confirmationText(r))}" target="_blank" rel="noopener">Envoyer la confirmation</a>
        <a class="btn small" href="tel:${esc(r.phone.replace(/[^+\d]/g, ''))}">Appeler</a>
      </div>
    </div>

    <div class="section">
      <h3>Location</h3>
      <dl class="kv">
        <dt>Voiture</dt><dd>${esc(r.car)}</dd>
        <dt>Prise en charge</dt><dd>${fmtDateLong(r.start_date)} à ${hm(r.start_time)}</dd>
        <dt>Retour</dt><dd>${fmtDateLong(r.end_date)} à ${hm(r.end_time)}</dd>
        <dt>Durée</dt><dd>${r.days} jour${r.days > 1 ? 's' : ''}</dd>
        <dt>Livraison</dt><dd>${esc(PLACE[r.place] ?? r.place)}${r.flight ? ` · vol ${esc(r.flight)}` : ''}</dd>
        <dt>Total estimé</dt><dd>${mad(r.estimate)}</dd>
      </dl>
      <details style="margin-top:12px"><summary class="link" style="justify-self:start">Modifier la voiture ou les dates</summary>
        <form class="card" id="editForm" style="margin-top:10px">
          <label>Voiture <select name="car">${CARS.map(c => { const n = `${c.make} ${c.model}`; return `<option${n === r.car ? ' selected' : ''}>${esc(n)}</option>`; }).join('')}${CARS.some(c => `${c.make} ${c.model}` === r.car) ? '' : `<option selected>${esc(r.car)}</option>`}</select></label>
          <div class="row2"><label>Début <input name="start_date" type="date" value="${r.start_date}"></label><label>Heure <input name="start_time" type="time" value="${hm(r.start_time)}"></label></div>
          <div class="row2"><label>Fin <input name="end_date" type="date" value="${r.end_date}"></label><label>Heure <input name="end_time" type="time" value="${hm(r.end_time)}"></label></div>
          <label>Livraison <select name="place">${Object.entries(PLACE).map(([k, v]) => `<option value="${k}"${k === r.place ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>N° de vol <input name="flight" value="${esc(r.flight ?? '')}" maxlength="20"></label>
          <button class="btn primary small" type="submit">Enregistrer les modifications</button>
        </form>
      </details>
    </div>

    <div class="section">
      <h3>Paiement et caution</h3>
      <div class="row2">
        <label>Mode (choisi par le client)
          <select data-field="payment">${Object.entries(PAYMENT).map(([k, v]) => `<option value="${k}"${k === r.payment ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Règlement
          <select data-field="payment_status">${Object.entries(PAY_STATUS).map(([k, v]) => `<option value="${k}"${k === r.payment_status ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Caution
          <select data-field="deposit_status">${Object.entries(DEPOSIT).map(([k, v]) => `<option value="${k}"${k === r.deposit_status ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Suivi par
          <select data-field="assigned_to"><option value="">Personne</option>${team.map(t => `<option value="${t.user_id}"${t.user_id === r.assigned_to ? ' selected' : ''}>${esc(t.name || t.email)}</option>`).join('')}</select></label>
      </div>
    </div>

    <div class="section crypto">
      <h3>Paiement crypto (NOWPayments)</h3>
      ${r.payment_url ? `
        <p class="help">Lien créé le ${fmtStamp(r.payment_link_at)} pour <b>${mad(r.payment_amount)}</b>${r.paid_at ? ` · payé le ${fmtStamp(r.paid_at)}` : ''}.</p>
        <div class="contact">
          <a class="btn small primary" href="${wa(r.phone, paymentText(r))}" target="_blank" rel="noopener">Envoyer le lien sur WhatsApp</a>
          <button class="btn small" type="button" data-act="copy-link">Copier le lien</button>
          <a class="btn small ghost" href="${esc(r.payment_url)}" target="_blank" rel="noopener">Ouvrir la page de paiement</a>
        </div>` : ''}
      ${r.payment_status !== 'paid' && !['cancelled', 'returned'].includes(r.status) ? `
        <form class="pay-link" id="payLinkForm">
          <label>Montant à payer (MAD) <input name="amount" type="number" min="1" step="1" value="${r.payment_amount ?? r.estimate}" required></label>
          <button class="btn small${r.payment_url ? '' : ' primary'}" type="submit">${r.payment_url ? 'Créer un nouveau lien' : 'Créer le lien de paiement crypto'}</button>
        </form>
        ${r.status === 'new' ? '<p class="help">Conseil : confirmez d\'abord la disponibilité, puis envoyez le lien.</p>' : ''}` : ''}
      <ul class="history" id="payHistory"></ul>
    </div>

    <div class="section">
      <h3>Notes internes</h3>
      <textarea id="notes" placeholder="Visibles par l'équipe uniquement">${esc(r.notes ?? '')}</textarea>
      <button class="btn small" type="button" data-act="notes" style="margin-top:8px">Enregistrer la note</button>
    </div>

    <div class="section">
      <h3>Historique</h3>
      <ul class="history" id="history"><li>Chargement…</li></ul>
    </div>

    ${me.role === 'admin' ? '<div class="section"><button class="btn danger small" type="button" data-act="delete">Supprimer définitivement</button></div>' : ''}
  `;
  if (!drawer.open) drawer.showModal();
  loadHistory(r);
  loadPayments(r);
}

async function loadPayments(r) {
  const { data } = await sb.from('payments').select('*').eq('reservation_id', r.id).order('created_at', { ascending: false });
  if (openId !== r.id || !$('#payHistory')) return;
  $('#payHistory').innerHTML = (data ?? []).map(p => `<li>${fmtStamp(p.created_at)} · <b>${NP_STATUS[p.status] ?? esc(p.status)}</b>${
    p.actually_paid ? ` · reçu ${esc(p.actually_paid)} ${esc(String(p.pay_currency ?? '').toUpperCase())}` : p.pay_amount ? ` · attendu ${esc(p.pay_amount)} ${esc(String(p.pay_currency ?? '').toUpperCase())}` : ''}</li>`).join('');
}

async function loadHistory(r) {
  const { data } = await sb.from('reservation_events').select('*').eq('reservation_id', r.id).order('at', { ascending: false });
  const label = e => ({
    created: 'Demande reçue depuis le site',
    status: `Statut : ${STATUS[e.old_value] ?? e.old_value} → <b>${STATUS[e.new_value] ?? e.new_value}</b>`,
    payment_status: `Règlement : ${PAY_STATUS[e.old_value]} → <b>${PAY_STATUS[e.new_value]}</b>`,
    deposit_status: `Caution : ${DEPOSIT[e.old_value]} → <b>${DEPOSIT[e.new_value]}</b>`,
    notes: 'Note modifiée',
    details: `Modifiée : ${esc(e.old_value)} → <b>${esc(e.new_value)}</b>`,
  }[e.kind] ?? esc(e.kind));
  if (openId !== r.id) return;
  $('#history').innerHTML = (data ?? []).map(e =>
    `<li>${fmtStamp(e.at)} · ${label(e)}${e.actor_email ? ` · ${esc(e.actor_email)}` : e.kind !== 'created' && !e.actor ? ' · NOWPayments' : ''}</li>`).join('') || '<li>Rien pour le moment.</li>';
}

$('#drawerBody').addEventListener('click', async e => {
  const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
  const r = all.find(x => x.id === openId); if (!r) return;
  if (act === 'close') drawer.close();
  if (act === 'next') {
    const n = NEXT[r.status];
    if (n.to === 'confirmed' && clashes(r).length && !confirm('Cette voiture est déjà prise sur ces dates. Confirmer quand même ?')) return;
    await save(r.id, { status: n.to, ...(n.patch ?? {}) }, `${STATUS[n.to]}.`);
  }
  if (act === 'cancel' && confirm(`Annuler la réservation ${r.ref} ?`)) await save(r.id, { status: 'cancelled' }, 'Réservation annulée.');
  if (act === 'reopen') await save(r.id, { status: 'new' }, 'Réservation rouverte.');
  if (act === 'notes') await save(r.id, { notes: $('#notes').value.trim() || null }, 'Note enregistrée.');
  if (act === 'copy-link') { await navigator.clipboard.writeText(r.payment_url); toast('Lien copié.'); }
  if (act === 'delete' && confirm(`Supprimer définitivement la réservation ${r.ref} ? Cette action est irréversible.`)) {
    const { error } = await sb.from('reservations').delete().eq('id', r.id);
    if (error) { toast(`Échec : ${error.message}`, true); return; }
    all = all.filter(x => x.id !== r.id);
    drawer.close(); render(); toast('Réservation supprimée.');
  }
});
$('#drawerBody').addEventListener('change', async e => {
  const field = e.target.dataset.field; if (!field) return;
  await save(openId, { [field]: e.target.value || null }, 'Enregistré.');
});
$('#drawerBody').addEventListener('submit', async e => {
  if (e.target.id === 'payLinkForm') {
    e.preventDefault();
    const btn = $('button', e.target), amount = +e.target.amount.value;
    btn.disabled = true; btn.textContent = 'Création du lien…';
    const { data, error } = await sb.functions.invoke('crypto-invoice', { body: { action: 'create', reservation_id: openId, amount } });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = { not_configured: 'NOWPayments n\'est pas encore configuré (clés manquantes).', already_paid: 'Cette réservation est déjà payée.', nowpayments: `NOWPayments a refusé : ${j.message}` }[j.error] ?? j.message ?? j.error; } catch { /* keep generic */ }
      toast(`Échec : ${msg}`, true);
      btn.disabled = false; btn.textContent = 'Créer le lien de paiement crypto';
      return;
    }
    const r = all.find(x => x.id === openId);
    Object.assign(r, { payment: 'crypto', payment_url: data.url, payment_amount: data.amount, payment_link_at: new Date().toISOString(), payment_status: r.payment_status === 'unpaid' ? 'awaiting' : r.payment_status });
    toast('Lien de paiement créé. Envoyez-le au client.');
    render(); openDrawer(openId);
    return;
  }
  if (e.target.id !== 'editForm') return;
  e.preventDefault();
  const f = e.target;
  if (f.end_date.value <= f.start_date.value) { toast('La fin doit être après le début.', true); return; }
  await save(openId, {
    car: f.car.value, start_date: f.start_date.value, start_time: f.start_time.value, end_date: f.end_date.value, end_time: f.end_time.value,
    place: f.place.value, flight: f.flight.value.trim() || null,
  }, 'Réservation modifiée.');
});

/* ================= Planning ================= */
let planStart = addDays(new Date(), -2);
const PLAN_DAYS = 28;
function renderPlanning() {
  const days = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(planStart, i));
  const first = iso(days[0]), after = iso(addDays(days[0], PLAN_DAYS)), today = todayISO();
  const cars = [...new Set([...CARS.map(c => `${c.make} ${c.model}`), ...all.map(r => r.car)])];
  const dayIndex = d => Math.round((new Date(`${d}T12:00:00`) - new Date(`${first}T12:00:00`)) / 864e5);
  let html = `<div class="pl-grid" style="--days:${PLAN_DAYS}"><div class="pl-head"></div>` +
    days.map(d => `<div class="pl-head${iso(d) === today ? ' today' : ''}${[0, 6].includes(d.getDay()) ? ' weekend' : ''}">${d.toLocaleDateString('fr-FR', { weekday: 'short' })}<br>${d.getDate()}</div>`).join('');
  for (const car of cars) {
    const [make, ...model] = car.split(' ');
    const bars = all.filter(r => r.car === car && r.status !== 'cancelled' && r.start_date < after && r.end_date > first).map(r => {
      const a = Math.max(0, dayIndex(r.start_date)), b = Math.min(PLAN_DAYS, dayIndex(r.end_date) + 1);
      const c = `var(--st-${r.status})`;
      return `<button type="button" class="pl-bar${clashes(r).length ? ' clash' : ''}" data-id="${r.id}" style="--c:${c};left:calc(${a} / ${PLAN_DAYS} * 100%);width:calc(${b - a} / ${PLAN_DAYS} * 100% - 4px)"
        title="${esc(r.ref)} · ${esc(r.name)} · ${STATUS[r.status]}">${esc(r.name)}<small>${STATUS[r.status]} · ${esc(r.ref)}</small></button>`;
    }).join('');
    html += `<div class="pl-car">${esc(model.join(' ') || make)}<small>${esc(model.length ? make : '')}</small></div><div class="pl-lane">${bars}</div>`;
  }
  $('#planning').innerHTML = html + '</div>';
  $('#legend').innerHTML = Object.entries(STATUS).filter(([k]) => k !== 'cancelled').map(([k, v]) => `<span class="status s-${k}">${v}</span>`).join('') +
    '<span>Contour rouge : conflit de dates</span>';
}
$('#planning').addEventListener('click', e => { const b = e.target.closest('.pl-bar'); if (b) location.hash = `#/r/${b.dataset.id}`; });
$$('[data-shift]').forEach(b => b.addEventListener('click', () => {
  const n = +b.dataset.shift;
  planStart = n === 0 ? addDays(new Date(), -2) : addDays(planStart, n);
  renderPlanning();
}));

/* ================= Team ================= */
function renderTeam() {
  $('#teamRows').innerHTML = team.map(t => `<tr>
    <td>${esc(t.name || '—')}</td><td>${esc(t.email)}</td>
    <td>${t.user_id === me.id ? (t.role === 'admin' ? 'Admin' : 'Équipe') + ' (vous)' :
      `<select data-role="${t.user_id}"><option value="staff"${t.role === 'staff' ? ' selected' : ''}>Équipe</option><option value="admin"${t.role === 'admin' ? ' selected' : ''}>Admin</option></select>`}</td>
    <td>${fmtStamp(t.created_at)}</td>
    <td>${t.user_id === me.id ? '' : `<button class="btn danger small" type="button" data-remove="${t.user_id}">Retirer</button>`}</td>
  </tr>`).join('');
}
async function staffAdmin(body) {
  const { data, error } = await sb.functions.invoke('staff-admin', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = { last_admin: 'Il doit rester au moins un admin.', bad_email: 'E-mail invalide.', admin_only: 'Réservé aux admins.' }[j.error] ?? j.message ?? j.error; } catch { /* keep generic */ }
    toast(`Échec : ${msg}`, true);
    return null;
  }
  return data;
}
$('#inviteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, msg = $('.msg', f), btn = $('button', f);
  btn.disabled = true; msg.textContent = '';
  const ok = await staffAdmin({ action: 'invite', email: f.email.value, name: f.name.value, role: f.role.value });
  btn.disabled = false;
  if (ok) { msg.classList.add('ok'); msg.textContent = `Invitation envoyée à ${f.email.value}.`; f.reset(); await loadTeam(); renderTeam(); }
});
$('#teamRows').addEventListener('change', async e => {
  const id = e.target.dataset.role; if (!id) return;
  if (await staffAdmin({ action: 'set_role', user_id: id, role: e.target.value })) toast('Rôle mis à jour.');
  await loadTeam(); renderTeam();
});
$('#teamRows').addEventListener('click', async e => {
  const id = e.target.dataset.remove; if (!id) return;
  const t = team.find(x => x.user_id === id);
  if (!confirm(`Retirer ${t?.email} ? Son compte sera supprimé et il ne pourra plus se connecter.`)) return;
  if (await staffAdmin({ action: 'remove', user_id: id })) toast('Membre retiré.');
  await loadTeam(); renderTeam();
});

/* ================= Routing ================= */
function route() {
  if (!me) return;
  const h = location.hash || '#/';
  const view = h.startsWith('#/planning') ? 'planning' : h.startsWith('#/equipe') && me.role === 'admin' ? 'team' : 'list';
  $('#view-list').hidden = view !== 'list';
  $('#view-planning').hidden = view !== 'planning';
  $('#view-team').hidden = view !== 'team';
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (view === 'planning') renderPlanning();
  if (view === 'team') renderTeam();
  const m = /^#\/r\/([0-9a-f-]{36})/.exec(h);
  if (m) openDrawer(m[1]); else if (drawer.open) drawer.close();
}
addEventListener('hashchange', route);

/* ================= Start ================= */
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (arrivedFor && session) { showAuth('password'); return; }   // invitation or reset: choose a password first
  if (session) await enter(); else showAuth('login');
})();
