// WeatherDashboard service worker.
// On install it saves the page and its small files, so the dashboard opens without a connection.
// While online it always asks the network first, so a new version arrives on the next visit.
// Weather data (api/) is never stored here: the TAF side keeps its own last fetch and shows its age.
// v1.23: also shows the one-time "new TAF" push notifications sent by the taf-alerts Worker (the bell on a TAF card).
const CACHE = 'weatherdashboard';
const FILES = ['./', 'minima.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.svg', 'favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(new Request(req.url, { cache: 'no-cache' }))
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './' : req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});

// Push from taf-alerts: always show a notification (iOS revokes the subscription otherwise), and tell an open page so its bell goes back to an outline.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'New TAF', { body: d.body || '', tag: d.tag || 'taf', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' } }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => l.forEach(c => c.postMessage({ type: 'taf-bell-sent', icao: d.icao })))
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
