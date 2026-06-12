// Service worker: cache-first offline support. The cache name embeds the
// deployed commit (the workflow rewrites APP_VERSION below), so every deploy
// gets a fresh cache and activate() drops the old ones.
const APP_VERSION = 'local-dev';
const CACHE = `ser-${APP_VERSION}`;

const PRECACHE = [
  '.',
  'index.html',
  'version.js',
  'manifest.webmanifest',
  'ui.css',
  'vendor/phaser.min.js',
  'src/main.js',
  'src/ui.js',
  'src/constants.js',
  'src/projection.js',
  'src/worlds.js',
  'src/audio.js',
  'src/cosmetics.js',
  'src/scenes/BootScene.js',
  'src/scenes/GameScene.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // ignoreSearch: the deploy adds ?v=<sha> cache-busters to entry points
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
