import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// tRPC API calls — NetworkFirst (fresh data when online, cached when offline)
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/trpc"),
  new NetworkFirst({
    cacheName: "trpc-cache",
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })],
  })
);

// Menu item images — CacheFirst with 7-day expiry
registerRoute(
  ({ url }) => url.hostname.includes("r2.dev") || url.pathname.startsWith("/images/"),
  new CacheFirst({
    cacheName: "menu-images",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
);

// Google Fonts
registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts" })
);

// Push notification handler
self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() as { title: string; body: string; url?: string } | undefined;
  if (!data) return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url },
    })
  );
});

// Tap notification → open URL
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});
