/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Minimal service worker — enables PWA installability with no offline caching.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
