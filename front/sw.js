const SW_VERSION = "ha-sw-v3";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/main.js?v=20260222",
  "/auth-ui.js?v=20260222",
  "/analytics.js?v=20260222",
  "/seo.js?v=20260228",
  "/manifest.webmanifest",
  "/site-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== SW_VERSION) return caches.delete(key);
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isApi = sameOrigin && url.pathname.startsWith("/api/");
  if (isApi) return;

  const isMedia = req.destination === "image" || req.destination === "video";
  const isUploads = sameOrigin && url.pathname.startsWith("/uploads/");
  const cacheable = sameOrigin || isMedia;

  if (!cacheable) return;

  const offlineFallback = () =>
    new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });

  // Cache-first for media for faster repeat loads on user device.
  if (isMedia || isUploads) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(SW_VERSION).then((cache) => cache.put(req, res.clone())).catch(() => {});
            }
            return res;
          })
          .catch(() => cached || offlineFallback());
      })
    );
    return;
  }

  // Stale-while-revalidate for app shell/static files.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(SW_VERSION).then((cache) => cache.put(req, fresh.clone())).catch(() => {});
          }
          return fresh;
        })
        .catch(() =>
          (cached ? Promise.resolve(cached) : caches.match("/index.html"))
            .then((fallback) => fallback || offlineFallback())
        );
      return cached || networkFetch;
    })
  );
});
