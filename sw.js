// WeatherDashboard service worker.
// On install it saves the page and its small files, so the dashboard opens without a connection.
// While online it always asks the network first, so a new version arrives on the next visit.
// Weather data (api/) is never stored here: the TAF side keeps its own last fetch and shows its age.
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
