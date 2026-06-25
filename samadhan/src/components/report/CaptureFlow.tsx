"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  MapPin,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createReport } from "@/lib/reports";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Loc = { lat: number; lng: number; accuracyM: number };
type LocState =
  | { tag: "idle" }
  | { tag: "locating" }
  | { tag: "ok"; loc: Loc }
  | { tag: "error"; code: number };

// Capture flow (frontend-plan §D C2). Photo + auto-GPS + optional note → createReport.
// GPS is required: denial is an error state with retry (no fake coordinate — that
// would corrupt dedup/routing/the map downstream). The real map-pin fallback is C4.
export function CaptureFlow() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loc, setLoc] = useState<LocState>({ tag: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLoc({ tag: "error", code: 2 });
      return;
    }
    setLoc({ tag: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLoc({
          tag: "ok",
          loc: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          },
        }),
      (err) => setLoc({ tag: "error", code: err.code }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setSubmitError(null);
    if (loc.tag === "idle" || loc.tag === "error") requestLocation();
  };

  const canSubmit = !!file && loc.tag === "ok" && !!user && !submitting;

  const submit = async () => {
    if (!file || loc.tag !== "ok" || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    setProgress(0);
    try {
      const id = await createReport({
        uid: user.uid,
        file,
        lat: loc.loc.lat,
        lng: loc.loc.lng,
        accuracyM: loc.loc.accuracyM,
        rawText: note,
        onProgress: setProgress,
      });
      router.push(`/report/${id}`);
    } catch (err) {
      console.error("[capture] submit failed", err);
      setSubmitError("Couldn’t submit — your photo is safe. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Home
      </Link>

      <h1 className="mt-4 font-display text-[24px] font-normal tracking-[-0.01em] text-ink">
        Report an issue
      </h1>
      <p className="mt-1 text-[14px] text-muted">
        Snap the problem — the agent classifies, locates and files it for you.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPick}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-8 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-hairline bg-stone/40 text-brand transition active:scale-[0.99] hover:bg-stone"
        >
          <span className="grid size-16 place-items-center rounded-full bg-brand text-on-dark">
            <Camera className="size-8" strokeWidth={1.5} />
          </span>
          <span className="font-sans text-[15px] text-ink">Take a photo</span>
          <span className="text-[13px] text-muted">or choose from your gallery</span>
        </button>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="overflow-hidden rounded-lg border border-hairline bg-stone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? undefined}
              alt="Issue preview"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-[13px] text-link transition hover:opacity-80"
          >
            <RefreshCw className="size-4" strokeWidth={1.5} /> Retake
          </button>

          <LocationChip state={loc} onRetry={requestLocation} />

          <label className="block">
            <span className="text-[13px] text-muted">Add a note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="e.g. near the bus stop, getting worse"
              className="mt-1.5 w-full rounded-xs border border-hairline bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-focus"
            />
          </label>

          {submitError ? (
            <p className="flex items-start gap-2 rounded-sm bg-danger/5 px-3 py-2 text-[13px] text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
              {submitError}
            </p>
          ) : null}

          <Button
            variant="brand"
            onClick={submit}
            loading={submitting}
            disabled={!canSubmit}
            className="w-full"
          >
            {submitting
              ? progress > 0 && progress < 100
                ? `Uploading ${progress}%`
                : "Submitting…"
              : "Report this"}
          </Button>
          {loc.tag !== "ok" && !submitting ? (
            <p className="text-center text-[12px] text-muted">
              A location is needed before you can report.
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}

function LocationChip({
  state,
  onRetry,
}: {
  state: LocState;
  onRetry: () => void;
}) {
  if (state.tag === "ok") {
    return (
      <div className="flex items-center gap-2 rounded-sm bg-wash-green px-3 py-2.5 text-[13px] text-brand">
        <MapPin className="size-4 shrink-0" strokeWidth={1.5} />
        Location captured
        <span className="font-mono text-[12px] text-muted">
          ±{Math.round(state.loc.accuracyM)}m
        </span>
      </div>
    );
  }
  if (state.tag === "locating") {
    return (
      <div className="flex items-center gap-2 rounded-sm bg-stone px-3 py-2.5 text-[13px] text-ink">
        <LoaderCircle className="size-4 shrink-0 animate-spin" strokeWidth={1.5} />
        Finding your location…
      </div>
    );
  }
  if (state.tag === "error") {
    const msg =
      state.code === 1
        ? "Location permission denied — enable it to report (needed to route your issue)."
        : "Couldn’t get your location.";
    return (
      <div className="rounded-sm bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          <span>{msg}</span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink underline underline-offset-4",
          )}
        >
          <RefreshCw className="size-3.5" strokeWidth={1.5} /> Retry location
        </button>
      </div>
    );
  }
  return null;
}
