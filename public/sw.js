// NOXOMOR Ledger Service Worker
const CACHE_NAME = "noxomor-ledger-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "NOXOMOR Ledger", body: event.data.text() };
  }

  const title = payload.title || "NOXOMOR Ledger";
  const options = {
    body: payload.body || "Ada update baru untuk kamu",
    icon: "/icons/logo.png",
    badge: "/icons/logo.png",
    tag: payload.tag || "noxomor-notification",
    data: {
      url: payload.url || "/dashboard",
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
