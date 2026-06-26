/*
  Samadhan FCM service worker (C7 push). Receives background web-push and renders the
  notification. The firebase web SDK auto-registers THIS file at its dedicated scope
  '/firebase-cloud-messaging-push-scope' (getToken without serviceWorkerRegistration), so it
  never collides with the PWA's /sw.js at scope '/'.

  notificationclick is registered FIRST, before importing FCM — the official docs warn FCM
  may overwrite custom notificationclick behaviour otherwise.

  Compat importScripts (NOT modular): Next serves public/ files unbundled. Versions pinned to
  the installed firebase (12.15.0). Config = public NEXT_PUBLIC_* web config (not secret).
  Single-notification design: the server sends DATA-ONLY messages, so onBackgroundMessage
  renders exactly one notification (a top-level notification payload would auto-display +
  double-fire on web).
*/

// Open the issue when the notification is tapped (focus an existing tab if one is open).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === link && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    }),
  );
});

importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCRzdA8NXXYIYcLzJODr3O7wfYkmoZjEys",
  authDomain: "samadhan-civic-7k4m2.firebaseapp.com",
  projectId: "samadhan-civic-7k4m2",
  storageBucket: "samadhan-civic-7k4m2.firebasestorage.app",
  messagingSenderId: "554128679437",
  appId: "1:554128679437:web:ebfcdf6c13719d96e2eb44",
});

const messaging = firebase.messaging();

// Data-only messages → render exactly one notification here.
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Samadhan", {
    body: d.body || "",
    icon: d.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.issueId || undefined, // collapse repeated updates for the same issue
    data: { link: d.link || "/" },
  });
});
