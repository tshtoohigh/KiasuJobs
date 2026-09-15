/**
 * Minimal service worker: caches the app shell so a cold start on a flaky
 * connection still paints. API calls are never cached — job data must be live.
 */
const CACHE = 'kiasujobs-v1';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never cache Supabase traffic or anything non-GET.
  if (request.method !== 'GET' || request.url.includes('supabase')) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request)
          .then((response) => {
            // Only cache same-origin successes.
            if (response.ok && new URL(request.url).origin === self.location.origin) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match('/index.html').then((fallback) => fallback ?? Response.error())),
    ),
  );
});
