// Service worker for the staff panel app.
//  - shows a notification when the back end pushes a new booking, even with the app closed
//  - tapping it opens (or focuses) the panel on that booking
//  - keeps the app's own files so it opens instantly; reservation data always comes live from Supabase
const SHELL = 'carsw6-panel-v1';
const FILES = ['./', './admin.css', './admin.js', './icons/icon-192.png', '../assets/brand/carsw6-logo-sand.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// network first for the panel's own files (so updates land at once), cache as the offline fallback;
// anything else (Supabase, fonts, CDN) goes straight to the network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.includes('/admin/')) return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(SHELL).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'CARSW6', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title ?? 'Nouvelle demande', {
    body: data.body ?? '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag ?? 'carsw6',
    renotify: true,
    data: { url: data.url ?? './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url ?? './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    const open = wins.find(w => w.url.startsWith(self.registration.scope));
    if (open) { open.navigate(target); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
