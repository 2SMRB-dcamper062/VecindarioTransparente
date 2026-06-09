/*
  VecindarioTransparente Service Worker
  Manejo de Notificaciones Push en segundo plano y activas.
*/

self.addEventListener("push", (event) => {
  console.log("[Service Worker] Evento de Notificación Push recibido.");
  
  let data = {
    title: "VecindarioTransparente",
    body: "Nuevas actualizaciones en tu comunidad de vecinos.",
    url: "/"
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      console.warn("[Service Worker] Los datos del Push no contenían un JSON válido, usando texto bruto:", event.data.text());
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "https://api.dicebear.com/7.x/identicon/svg?seed=alameda",
    badge: "https://api.dicebear.com/7.x/identicon/svg?seed=alameda",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    },
    actions: [
      { action: "explore", title: "Ver en la App" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notificación presionada.");
  event.notification.close();

  const targetUrl = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
