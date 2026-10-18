// Offline support. Code (html/js/css/json) = network first, so updates arrive right away;
// game assets (images, sounds, fonts) = cache first. Everything stays playable offline.
const CACHE = 'icymario-v2';
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/main.js', 'js/gfx.js', 'js/game.js',
  'js/sound.js', 'js/input.js', 'js/bidi.js', 'fonts/Rubik.ttf', 'assets/assets.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const put = (req, res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return res; };
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const code = /\.(html|js|css|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith(code
    ? fetch(e.request).then(r => put(e.request, r)).catch(() => caches.match(e.request))
    : caches.match(e.request).then(hit => hit || fetch(e.request).then(r => put(e.request, r))));
});
