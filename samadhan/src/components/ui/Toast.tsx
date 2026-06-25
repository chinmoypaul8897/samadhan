"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { X } from "lucide-react";

// Minimal toast (frontend-plan §C Toast). Used for foreground FCM pushes (C7) and reused by
// C9/C10 success confirmations. Top-centre, auto-dismiss, flat + hairline per DESIGN.md.
type ToastItem = { id: number; title: string; body?: string };
type ToastApi = { toast: (t: { title: string; body?: string }) => void };

const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((t: { title: string; body?: string }) => {
    const id = ++seq;
    setItems((prev) => [...prev, { id, ...t }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-hairline bg-canvas px-4 py-3 shadow-lg"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[13px] text-muted">{t.body}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mr-1 rounded-full p-1 text-muted transition hover:bg-stone hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Safe no-op when used outside the provider (e.g. during SSR). */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { toast: () => {} };
}
