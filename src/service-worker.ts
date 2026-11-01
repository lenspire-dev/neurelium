import { self } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `neurelium-${version}`;
const scope = self.registration.scope;
const url = (path: string) => new URL(path, scope).href;
const ASSETS = new Set([
  ...immutable.map((file) => url(file.path)),
  ...assets.map((file) => url(file.path)),
  ...prerendered.map((file) => url(file.path)),
  scope
]);

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...ASSETS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const target = new URL(request.url);
  if (target.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(scope)) ?? Response.error();
      })
    );
    return;
  }

  if (ASSETS.has(target.href)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});
