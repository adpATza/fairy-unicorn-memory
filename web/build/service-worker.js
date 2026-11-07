/*
 * Memory Card Game service worker.
 * build/pwa.ts fills in VERSION and PRECACHE when it writes dist/sw.js.
 *
 * Every file of the build is cached on install, so the game works offline
 * after the first visit. A new version installs in the background and waits;
 * the page activates it only when the player chooses to update outside a round.
 */
const VERSION = '__VERSION__';
const PRECACHE = '__PRECACHE__';
// GitHub Pages project sites share an origin, so caches carry the app's name.
const PREFIX = 'memory-card-game-';
const CACHE = PREFIX + VERSION;
const SHELL = 'index.html';

self.addEventListener('install', (event) => {
  // `reload` skips the HTTP cache so a release never mixes old and new files.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Query strings such as ?seed= do not change the files served. Vary is
      // ignored because every cached file is static: module scripts send an
      // Origin header that the install requests did not, which would
      // otherwise miss responses carrying "Vary: Origin".
      const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match(SHELL, { ignoreVary: true });
        if (shell) return shell;
      }
      return fetch(request);
    })(),
  );
});
