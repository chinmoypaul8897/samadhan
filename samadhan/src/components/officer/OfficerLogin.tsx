"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";

// Officer sign-in (frontend-plan §D C8). Email/password against the seeded staff accounts
// (the contact-form-card look). Shown when /officer is hit by a citizen/anon. No dead end —
// a citizen who lands here just can't get past it.
export function OfficerLogin() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      // onAuthStateChanged loads the officer profile → the page swaps to the queue.
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(
        code.includes("invalid") || code.includes("wrong-password") || code.includes("user-not-found")
          ? "Wrong email or password."
          : code.includes("too-many-requests")
            ? "Too many attempts — try again shortly."
            : "Couldn’t sign in. Check your connection and try again.",
      );
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <div className="rounded-lg border border-hairline bg-canvas p-6 sm:p-8">
        <div className="grid size-11 place-items-center rounded-full bg-brand/10 text-brand">
          <ShieldCheck className="size-5" strokeWidth={1.5} />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-normal tracking-[-0.01em] text-ink">
          Officer sign-in
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          Authority staff only. Sign in to see your queue and resolve issues.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <label htmlFor="of-email" className="mb-1 block text-[13px] text-ink">
              Work email
            </label>
            <input
              id="of-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer.bbmp@samadhan.local"
              className="w-full rounded-sm border border-hairline bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-focus focus:ring-2 focus:ring-focus/30"
            />
          </div>
          <div>
            <label htmlFor="of-pass" className="mb-1 block text-[13px] text-ink">
              Password
            </label>
            <input
              id="of-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-hairline bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-focus focus:ring-2 focus:ring-focus/30"
            />
          </div>

          {error ? (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="brand" loading={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
