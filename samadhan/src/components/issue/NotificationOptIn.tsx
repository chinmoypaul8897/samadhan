"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { notificationsSupported, enableNotifications } from "@/lib/fcm";
import { useToast } from "@/components/ui/Toast";
import { buttonClasses } from "@/components/ui/Button";

// Push opt-in (frontend-plan §D C7). Shown to the issue's reporter. isSupported()-gated;
// requests permission only on an explicit tap (the value moment), then registers the device
// token. States: supported-default (CTA) / granted+token (on) / denied (soft note) /
// unsupported (soft note). No dead ends.
export function NotificationOptIn({ reporterUid }: { reporterUid: string }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);
  // useAuth().profile.fcmTokens is read once at sign-in and not refreshed in-session, so
  // right after enabling it's stale ([]). Track success locally so the "on" state shows.
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    notificationsSupported().then(setSupported);
    if (typeof window !== "undefined" && "Notification" in window) setPerm(Notification.permission);
  }, []);

  const isOwner = !!user && user.uid === reporterUid;
  if (!isOwner || supported === null) return null; // not the reporter, or still checking
  if (supported === false) return <Note icon={<BellOff />}>Push notifications aren’t supported on this browser.</Note>;

  const hasToken = (profile?.fcmTokens?.length ?? 0) > 0 || justEnabled;

  if (perm === "granted" && hasToken) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-brand/20 bg-wash-green px-3.5 py-2.5 text-[13px] text-ink">
        <BellRing className="size-4 shrink-0 text-brand" strokeWidth={1.5} />
        You’ll be notified as this issue moves.
      </div>
    );
  }
  if (perm === "denied") {
    return <Note icon={<BellOff />}>Notifications are blocked — turn them on in your browser settings to get updates.</Note>;
  }

  const enable = async () => {
    if (!user) return;
    setBusy(true);
    const res = await enableNotifications(user.uid);
    setBusy(false);
    if (typeof window !== "undefined" && "Notification" in window) setPerm(Notification.permission);
    if (res.status === "enabled") { setJustEnabled(true); toast({ title: "Notifications on", body: "We’ll ping you when this issue moves." }); }
    else if (res.status === "unsupported") setSupported(false);
    else if (res.status === "no-key") toast({ title: "Not available on this build yet", body: "Push will switch on shortly." });
    else if (res.status === "error") toast({ title: "Couldn’t enable notifications", body: "Please try again." });
  };

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      aria-busy={busy || undefined}
      className={buttonClasses("outline", "w-full")}
    >
      <Bell className="size-4" strokeWidth={1.5} />
      {busy ? "Enabling…" : "Get notified when this moves"}
    </button>
  );
}

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-md bg-stone/60 px-3.5 py-2.5 text-[13px] text-muted [&>svg]:size-3.5 [&>svg]:shrink-0">
      {icon}
      {children}
    </p>
  );
}
