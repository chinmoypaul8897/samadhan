/*
  Samadhan service worker — minimal (C0).
  Makes the app installable. Offline caching (Serwist) and FCM push handling
  are added in later chunks (C7 push, C12 offline).
*/
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch handler yet — network passthrough. Offline strategy comes in C12.
