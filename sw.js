// Caches the whole game so it loads instantly and plays with no connection.
// Bump CACHE_VERSION whenever you change index.html or the artwork.
const CACHE_VERSION = 'pokemon-battle-v16';

const CDN = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const local = await fetch('assets.json').then(r => r.json());
    await cache.addAll(local);
    // CDN files are opaque cross-origin responses; cache them one by one so a
    // single failure cannot abort the whole install.
    await Promise.all(CDN.map(url =>
      cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const hit = await caches.match(event.request);
    if (hit) return hit;
    try {
      const res = await fetch(event.request);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(event.request, res.clone());
      return res;
    } catch (err) {
      const shell = await caches.match('index.html');
      if (shell) return shell;
      throw err;
    }
  })());
});
