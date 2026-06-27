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

    let active = true;
    let unsub = () => {};

    const attach = () => {
      if (Notification.permission !== "granted") return;
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
    };

    attach();

    // Re-attach if the citizen opts in mid-session (permission → granted) without a reload —
    // the demo-critical background OS push is handled by the SW independently of this listener.
    let perm: PermissionStatus | null = null;
    const onChange = () => {
      if (Notification.permission === "granted") {
        unsub();
        unsub = () => {};
        attach();
      }
    };
    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((s) => {
        if (!active) return;
        perm = s;
        s.addEventListener("change", onChange);
      })
      .catch(() => {});

    return () => {
      active = false;
      unsub();
      perm?.removeEventListener("change", onChange);
    };
  }, [toast]);

  return null;
}
