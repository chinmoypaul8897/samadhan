/*
  Samadhan FCM service worker (C7 push). The firebase web SDK auto-registers this file at its
  dedicated scope '/firebase-cloud-messaging-push-scope' (getToken without
  serviceWorkerRegistration), so it never collides with the PWA's /sw.js at scope '/'.

  MINIMAL by design: importScripts + initializeApp + firebase.messaging(). Calling
  firebase.messaging() in the SW installs FCM's default push handler, which AUTO-DISPLAYS
  notification-payload messages in the background and opens webpush.fcmOptions.link on click.
  We deliberately do NOT register onBackgroundMessage — a handler suppresses that auto-display
  for notification messages (→ nothing shows), and data-only + a handler proved unreliable for
  background display on Android Chrome. The server therefore sends a `notification` payload.

  Compat importScripts (NOT modular): Next serves public/ files unbundled. Versions pinned to
  the installed firebase (12.15.0). Config = public NEXT_PUBLIC_* web config (not secret).
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

// Installs FCM's default background push handler (auto-displays notification messages).
firebase.messaging();
