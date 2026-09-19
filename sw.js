// Service worker : l'app doit rester utilisable dans le métro ou en avion.

const VERSION = 'poker-master-v3';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/db.js',
  'js/theme.js',
  'js/cards.js',
  'js/ranges.js',
  'js/parse.js',
  'js/grid.js',
  'js/stats.js',
  'js/drill.js',
  'js/equity.js',
  'js/card-art.js',
  'js/table.js',
  'js/views/home.js',
  'js/views/train.js',
  'js/views/drill.js',
  'js/views/odds.js',
  'js/views/combos.js',
  'js/views/audit.js',
  'js/views/stats.js',
  'js/views/ranges.js',
  'js/views/import.js',
  'js/views/settings.js',
  'data/demo-range.json',
  'data/mes-ranges.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll échoue en bloc si un seul fichier manque : on tolère les absences.
    await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      // Rafraîchit en arrière-plan sans bloquer l'affichage.
      fetch(request).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(request, res.clone()));
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(request);
      if (res.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, res.clone());
      }
      return res;
    } catch (err) {
      // Navigation hors ligne vers une route inconnue : on rend le shell.
      if (request.mode === 'navigate') {
        const shell = await caches.match('index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
