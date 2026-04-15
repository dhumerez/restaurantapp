/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Minimal service worker — enables PWA installability.
// A fetch handler is required by Chrome for the install prompt to appear.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clear all caches from previous SW versions so stale responses never block asset loading
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // For HTML navigation requests, bypass the browser HTTP cache entirely.
  // This ensures browsers always load the latest index.html after a deploy
  // instead of serving a stale version that references old asset hashes.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  // All other requests (JS, CSS, images) go through normally and respect
  // their own Cache-Control headers (content-hashed assets are safe to cache).
  event.respondWith(fetch(event.request));
});
