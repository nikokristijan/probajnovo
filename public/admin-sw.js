// Minimalni service worker za /admin PWA — postoji da zadovolji
// preglednikove uvjete za "instalabilnost" (Add to Home Screen / Install app)
// I da prima Web Push obavijesti (vidi lib/push.ts, komponenta
// PushNotificationToggle). Namjerno ne radi caching stranica: admin uvijek
// treba svježe podatke (upiti, kalendar), pa svaki fetch zahtjev jednostavno
// prosljeđujemo na mrežu.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// Payload je JSON string koji šalje lib/push.ts sendPushToAdmins:
// { title, body, url }.
self.addEventListener("push", (event) => {
  let data = { title: "NOVO admin", body: "", url: "/admin" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ništa, ostaje default
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      data: { url: data.url },
    })
  );
});

// Klik na obavijest fokusira postojeći /admin tab ako postoji (umjesto da
// otvara duplikat), inače otvara novi.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      for (const client of clients) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(() => client.navigate(url));
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
