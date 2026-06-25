"use client";

import { useEffect } from "react";

/** Registers the PWA service worker once on the client. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* registration is best-effort; app works without it */
    });
  }, []);
  return null;
}
