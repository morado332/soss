// Arena service worker — makes the app installable and shows an offline page.
// It deliberately does NOT cache pages or API responses (they contain private business data).
const CACHE = "arena-static-v1";
const OFFLINE_URL = "/offline.html";
const STATIC = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Only page navigations get the offline fallback; everything else goes straight to the network.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  } else if (STATIC.includes(new URL(req.url).pathname)) {
    event.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
