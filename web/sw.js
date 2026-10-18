// Offline support: cache-first for the game files (they never change within a version).
const CACHE = 'icymario-v1';
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/main.js', 'js/gfx.js', 'js/game.js',
  'js/sound.js', 'js/input.js', 'js/bidi.js', 'fonts/Rubik.ttf', 'assets/assets.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return r;
  })));
});
