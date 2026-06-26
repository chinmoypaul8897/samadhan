"use client";

import { useRef, useState } from "react";
import { RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getClientAuth } from "@/lib/firebase-client";
import { ConsentSheet } from "@/components/ui/ConsentSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

// Phone-OTP anonymous-upgrade sheet (frontend-plan §D C13). Two steps (phone → OTP) over the
// ConsentSheet. linkWithPhoneNumber (in auth-context) upgrades the current anon user in place —
// same uid, reports preserved. An invisible reCAPTCHA mounts on a hidden container (bypassed for
// Firebase test numbers, which is how we verify SMS-free). Surfaces Firebase error codes plainly.

function mapErr(code: string): string {
  if (code.includes("invalid-phone-number")) return "That phone number doesn’t look right.";
  if (code.includes("invalid-verification-code")) return "Wrong code — check and try again.";
  if (code.includes("code-expired")) return "That code expired — request a new one.";
  if (code.includes("too-many-requests")) return "Too many attempts — try again shortly.";
  if (code.includes("already-in-use") || code.includes("account-exists"))
    return "That number is already linked to another account.";
  if (code.includes("captcha")) return "Couldn’t verify you’re human — please retry.";
  return "Couldn’t verify your phone. Check your connection and try again.";
}

export function PhoneUpgradeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { startPhoneUpgrade, confirmPhoneOtp } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+91 ");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    verifierRef.current?.clear();
    verifierRef.current = null;
    confirmationRef.current = null;
    setStep("phone");
    setCode("");
    setErr(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const sendCode = async () => {
    const e164 = phone.replace(/\s+/g, "");
    if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
      setErr("Enter a valid number with country code, e.g. +91 98765 43210.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (!verifierRef.current && recaptchaRef.current) {
        verifierRef.current = new RecaptchaVerifier(getClientAuth(), recaptchaRef.current, {
          size: "invisible",
        });
      }
      confirmationRef.current = await startPhoneUpgrade(e164, verifierRef.current!);
      setStep("otp");
    } catch (e) {
      setErr(mapErr((e as { code?: string }).code ?? ""));
      verifierRef.current?.clear(); // allow a clean retry
      verifierRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!confirmationRef.current) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setErr("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await confirmPhoneOtp(confirmationRef.current, code.trim());
      toast({ title: "Phone verified", body: "Your reports are now saved to your number." });
      close();
    } catch (e) {
      setErr(mapErr((e as { code?: string }).code ?? ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsentSheet
      open={open}
      onClose={close}
      title={step === "phone" ? "Save your reports" : "Enter the code"}
      subtitle={
        step === "phone"
          ? "Add your phone so you can pick up your reports on any device."
          : `We sent a 6-digit code to ${phone.trim()}.`
      }
      footer={
        <Button
          variant="brand"
          className="w-full"
          loading={busy}
          onClick={step === "phone" ? sendCode : verify}
        >
          {step === "phone" ? "Send code" : "Verify & save"}
        </Button>
      }
    >
      <div className="space-y-3">
        {step === "phone" ? (
          <label className="block">
            <span className="text-[13px] text-muted">Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="mt-1.5 w-full rounded-xs border border-hairline bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none focus:border-focus"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-[13px] text-muted">6-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="mt-1.5 w-full rounded-xs border border-hairline bg-canvas px-3 py-2.5 font-mono text-[17px] tracking-[0.3em] text-ink outline-none focus:border-focus"
            />
          </label>
        )}
        {err ? (
          <p className="rounded-sm bg-danger/5 px-3 py-2 text-[13px] text-danger">{err}</p>
        ) : null}
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <ShieldCheck className="size-3.5 shrink-0" strokeWidth={1.5} /> Your anonymous reports
          stay linked to this number.
        </p>
        <div ref={recaptchaRef} />
      </div>
    </ConsentSheet>
  );
}
