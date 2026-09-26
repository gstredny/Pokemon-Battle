// Keeps a copy of the game so it still plays with no connection. When online,
// every file comes from the network first, so a new version shows right away.
// Bump CACHE_VERSION whenever you change index.html or the artwork.
const CACHE_VERSION = 'pokemon-battle-v33';

const CDN = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// Take over at once. Saving the whole game (about 40 MB) happens afterwards, so
// a phone never has to finish that download before it sees the new version.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
  saveWholeGame();
});

async function saveWholeGame() {
  const cache = await caches.open(CACHE_VERSION);
  const local = await fetch('assets.json', { cache: 'reload' }).then(r => r.json()).catch(() => []);
  // One file at a time, skipping any already saved, so a slow phone keeps its
  // connection for the game and a failure only skips that one file.
  for (const url of local) {
    if (await cache.match(url)) continue;
    await cache.add(new Request(url, { cache: 'reload' })).catch(() => {});
  }
  // CDN files are opaque cross-origin responses.
  for (const url of CDN) {
    if (await cache.match(url)) continue;
    await cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {});
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(event.request) || await caches.match('index.html');
      if (hit) return hit;
      throw err;
    }
  })());
});
