/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Minimal service worker — enables PWA installability.
// A fetch handler is required by Chrome for the install prompt to appear.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass all requests straight through — no caching (installable-only mode).
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
