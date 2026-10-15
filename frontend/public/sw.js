// Service worker: installable app, and usable in the field without signal.
// - Pages: network first; when offline the last loaded app shell is served (it is the same index.html for every route).
// - Built assets, icons and photos: cache first (file names are content-hashed or static).
// - The investor's own data (session, applications, monitoring): network first, last copy when offline.
//   This cache is personal and is deleted on sign-out.
// Photo reports made offline are queued in IndexedDB by the page itself and sent when the connection returns.
const SHELL = "aqrar-shell-v2";
const STATIC = "aqrar-static-v2";
const API = "aqrar-api";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", OFFLINE, "/manifest.webmanifest", "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, STATIC, API].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const personal = (p) => p === "/api/v1/auth/me" || p.startsWith("/api/v1/me/") || p === "/api/v1/public/meta";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) caches.open(SHELL).then((c) => c.put("/", res.clone())); return res; })
        .catch(async () => (await caches.match("/")) || caches.match(OFFLINE)),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/world/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
      return res;
    })));
    return;
  }
  if (personal(url.pathname) && !url.pathname.endsWith("/photo")) {
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) caches.open(API).then((c) => c.put(req, res.clone())); return res; })
        .catch(async () => (await caches.match(req)) || new Response(JSON.stringify({ message: "İnternet yoxdur" }), { status: 503, headers: { "Content-Type": "application/json" } })),
    );
  }
});
