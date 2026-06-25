"use client";

import { useEffect } from "react";
import { listenForeground } from "@/lib/fcm";
import { useToast } from "@/components/ui/Toast";

// Global foreground-push listener (C7). When the app is in focus the FCM SW does NOT show a
// notification — onMessage fires here instead, and we surface an in-app toast. Only wires up
// if permission is already granted (never prompts on load). Mounts inside ToastProvider.
export function FcmForeground() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let active = true;
    let unsub = () => {};
    listenForeground((payload) => {
      const d = payload.data ?? {};
      toast({
        title: d.title || payload.notification?.title || "Samadhan",
        body: d.body || payload.notification?.body,
      });
    }).then((u) => {
      if (active) unsub = u;
      else u();
    });

    return () => {
      active = false;
      unsub();
    };
  }, [toast]);

  return null;
}
