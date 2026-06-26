"use client";

import { useAuth } from "@/lib/auth-context";
import { OfficerLogin } from "@/components/officer/OfficerLogin";
import { OfficerQueue } from "@/components/officer/OfficerQueue";

// /officer (frontend-plan §D C8). Gate on the auth profile: staff → the queue; anyone else →
// the login. The OfficerShell (via AppShell) wraps both.
export default function OfficerPage() {
  const { profile, loading } = useAuth();
  const isStaff = profile?.role === "officer" || profile?.role === "admin";

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6" aria-hidden>
        <div className="h-40 animate-pulse rounded-lg bg-stone" />
      </main>
    );
  }

  return isStaff ? <OfficerQueue /> : <OfficerLogin />;
}
