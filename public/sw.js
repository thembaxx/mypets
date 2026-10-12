const CACHE = 'mypets-shell-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/animals/dog.webp',
  '/animals/cat.webp',
  '/animals/rabbit.webp',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('mypets-shell-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  if (new URL(event.request.url).pathname === '/runtime/llama-3.2-1b-q4f32-v0.2.86.wasm') {
    // Keep optional model storage separate from the app shell and image recognition.
    event.respondWith(
      caches.open('nuzzle-assistant-runtime-v1').then(async (cache) => {
        const saved = await cache.match(event.request);
        if (saved) return saved;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      const response =
        cached ||
        (await fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return response;
        }));
      // A cached Response carries its precache URL, which omits the fragment
      // containing Turbopack's worker bootstrap parameters. A synthetic response
      // preserves the original worker URL, including those parameters, offline.
      return ['worker', 'sharedworker'].includes(event.request.destination)
        ? new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          })
        : response;
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('/?tab=schedule');
    }),
  );
});
