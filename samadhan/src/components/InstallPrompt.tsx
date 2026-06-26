"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// PWA install prompt (frontend-plan §D C12). Captures Chrome/Edge's `beforeinstallprompt`, hides
// the default mini-infobar, and offers our own dismissible "Install Samadhan" strip. Remembers a
// dismissal in localStorage and never shows once installed (standalone). Renders nothing where
// the event never fires (iOS Safari) — a graceful no-op, not a broken affordance.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "samadhan_install_dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* localStorage blocked → treat as not dismissed */
    }
    if (standalone || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress the default infobar; we drive our own UI
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    setShow(false);
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
  };

  if (!show) return null;

  return (
    <div
      className="animate-fade-up fixed inset-x-0 bottom-20 z-40 px-4"
      role="dialog"
      aria-label="Install Samadhan"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-md border border-hairline bg-canvas px-3 py-2.5 shadow-lg">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
          <Download className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">Install Samadhan</p>
          <p className="truncate text-[12px] text-muted">Add it to your home screen.</p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex min-h-11 shrink-0 items-center rounded-pill bg-brand px-4 text-[13px] font-medium text-on-dark transition active:scale-[0.97]"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-stone hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
