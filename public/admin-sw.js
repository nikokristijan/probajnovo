// Minimalni service worker za /admin PWA — postoji samo da zadovolji
// preglednikove uvjete za "instalabilnost" (Add to Home Screen / Install app).
// Namjerno ne radi nikakav caching: admin uvijek treba svježe podatke
// (upiti, kalendar), pa svaki zahtjev jednostavno prosljeđujemo na mrežu.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
