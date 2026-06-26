"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

// Optional voice note (frontend-plan §C2, C13). MediaRecorder → audio/webm Blob handed up to
// the capture flow; the intake transcribes it with Gemini. Voice is ADDITIVE — the photo stays
// required and a denied mic never blocks reporting (you can still type a note). Caps at 30s.

type State = "idle" | "recording" | "recorded" | "denied" | "unsupported";
const MAX_MS = 30_000;

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  onChange,
  disabled,
}: {
  onChange: (blob: Blob | null) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autostopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof MediaRecorder === "undefined") setState("unsupported");
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (autostopRef.current) clearTimeout(autostopRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autostopRef.current) clearTimeout(autostopRef.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stopTracks();
        const u = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = u;
        setUrl(u);
        onChange(blob);
        setState("recorded");
      };
      recRef.current = rec;
      rec.start();
      setSecs(0);
      setState("recording");
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
      autostopRef.current = setTimeout(stop, MAX_MS);
    } catch {
      stopTracks();
      setState("denied");
    }
  };

  const clear = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    onChange(null);
    setSecs(0);
    setState("idle");
  };

  if (state === "unsupported") return null;

  if (state === "recording") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-danger/30 bg-danger/5 px-3 py-2.5">
        <span className="flex items-center gap-2 text-[13px] text-danger">
          <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
          Recording… <span className="font-mono">{fmt(secs)}</span>
        </span>
        <button
          type="button"
          onClick={stop}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-danger px-4 text-[13px] font-medium text-on-dark transition active:scale-[0.97]"
        >
          <Square className="size-3.5" strokeWidth={2} fill="currentColor" /> Stop
        </button>
      </div>
    );
  }

  if (state === "recorded" && url) {
    return (
      <div className="flex items-center gap-3 rounded-sm border border-hairline bg-stone/40 px-3 py-2.5">
        <Mic className="size-4 shrink-0 text-brand" strokeWidth={1.75} />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={url} controls className="h-8 min-w-0 flex-1" />
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          aria-label="Delete voice note"
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-stone hover:text-ink"
        >
          <Trash2 className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline px-4 text-[13px] font-medium text-ink transition hover:bg-stone active:scale-[0.98] disabled:opacity-60"
      >
        <Mic className="size-4 text-brand" strokeWidth={1.75} /> Add a voice note
      </button>
      {state === "denied" ? (
        <p className="mt-1.5 text-[12px] text-muted">
          Mic permission denied — you can still type a note above.
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted">
          Speak the problem in any language — the agent transcribes it.
        </p>
      )}
    </div>
  );
}
