"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import {
  GROUP_ICON,
  GROUP_LABEL,
  type ServiceCategory,
} from "@/lib/categories";

type Status = "loading" | "ready" | "empty" | "error";

// The 8 reportable categories, read live from serviceCatalog (data-shapes.md §3).
// Tapping a category drops into the capture flow (wired in C2).
export function CategoryGrid() {
  const [items, setItems] = useState<ServiceCategory[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const q = query(collection(db, "serviceCatalog"), orderBy("serviceName"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => d.data() as ServiceCategory);
        setItems(next);
        setStatus(next.length ? "ready" : "empty");
      },
      (err) => {
        console.error("[serviceCatalog] load failed", err);
        setStatus("error");
      },
    );
    return () => unsub();
  }, []);

  if (status === "loading") return <SkeletonGrid />;
  if (status === "error")
    return <Notice>Couldn’t load categories — check your connection.</Notice>;
  if (status === "empty")
    return <Notice>Categories appear once the catalogue is seeded.</Notice>;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((c) => {
        const Icon = GROUP_ICON[c.group] ?? GROUP_ICON.other;
        return (
          <li key={c.serviceCode}>
            <Link
              href="/report"
              className="flex h-full flex-col gap-2 rounded-md border border-hairline bg-stone/40 p-4 transition active:scale-[0.98] hover:border-brand/40 hover:bg-stone"
            >
              <Icon className="size-6 text-brand" strokeWidth={1.5} />
              <span className="font-sans text-[15px] leading-snug text-ink">
                {c.serviceName}
              </span>
              <span className="mt-auto font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
                {GROUP_LABEL[c.group]} · {c.slaHours}h SLA
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-md border border-hairline bg-stone/50"
        />
      ))}
    </ul>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-hairline px-4 py-8 text-center text-[14px] text-muted">
      {children}
    </div>
  );
}
