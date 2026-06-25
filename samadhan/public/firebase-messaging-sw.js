/*
  Samadhan FCM service worker (C7 push). Receives background web-push and renders the
  notification. Separate from /sw.js (the PWA SW) — FCM requires a file named
  firebase-messaging-sw.js at the origin root.

  Compat importScripts (NOT modular): Next serves public/ files unbundled, and a modular
  ES-module service worker needs bundling. Versions pinned to the installed firebase
  (12.15.0) — bump these URLs if firebase is upgraded. Config is the public NEXT_PUBLIC_*
  web config (not secret; already shipped in the client bundle).

  Single-notification design: the server sends DATA-ONLY messages, so we render exactly one
  notification here via onBackgroundMessage (a top-level notification payload would also
  auto-display and double-fire). Foreground messages are handled by onMessage in the app.
*/
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

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const title = d.title || "Samadhan";
  self.registration.showNotification(title, {
    body: d.body || "",
    icon: d.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.issueId || undefined, // collapse repeated updates for the same issue
    data: { link: d.link || "/" },
  });
});

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
