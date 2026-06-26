"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  linkWithPhoneNumber,
  type ConfirmationResult,
  type RecaptchaVerifier,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, getClientAuth } from "@/lib/firebase-client";

export type LanguagePref = "en" | "hi";

// Client-facing slice of users/{uid} (data-shapes.md §2). Officer-only fields are present
// for seeded staff (the source of truth for authority remains the verified ID-token claim;
// these are for display only — never trust them for authorization).
export type CitizenProfile = {
  uid: string;
  role: "citizen" | "officer" | "admin";
  displayName: string;
  isAnonymous: boolean;
  phone?: string | null;
  languagePref: LanguagePref;
  fcmTokens: string[];
  authorityId?: string | null;
  department?: string | null;
  jurisdictionWards?: string[];
};

type AuthState = {
  user: User | null;
  profile: CitizenProfile | null;
  loading: boolean;
  setLanguage: (lang: LanguagePref) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  startPhoneUpgrade: (phone: string, verifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  confirmPhoneOtp: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Create the users/{uid} doc on first sign-in; touch lastActiveAt thereafter.
// The lastActiveAt touch is best-effort (an officer doc would be blocked by the
// citizen update rule — fine, officers manage themselves via the portal in C8).
async function ensureUserDoc(user: User): Promise<CitizenProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const profile: CitizenProfile = {
      uid: user.uid,
      role: "citizen",
      displayName: user.displayName ?? "Anonymous Citizen",
      isAnonymous: user.isAnonymous,
      languagePref: "en",
      fcmTokens: [],
    };
    await setDoc(ref, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
    return profile;
  }

  const data = snap.data();
  void updateDoc(ref, { lastActiveAt: serverTimestamp() }).catch(() => {});
  return {
    uid: user.uid,
    role: (data.role as CitizenProfile["role"]) ?? "citizen",
    displayName: (data.displayName as string) ?? "Anonymous Citizen",
    isAnonymous: (data.isAnonymous as boolean) ?? user.isAnonymous,
    phone: (data.phone as string | undefined) ?? null,
    languagePref: (data.languagePref as LanguagePref) ?? "en",
    fcmTokens: (data.fcmTokens as string[]) ?? [],
    authorityId: (data.authorityId as string | undefined) ?? null,
    department: (data.department as string | undefined) ?? null,
    jurisdictionWards: (data.jurisdictionWards as string[] | undefined) ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          setProfile(await ensureUserDoc(u));
        } catch (err) {
          console.error("[auth] ensureUserDoc failed", err);
        }
        setLoading(false);
        return;
      }
      // No session yet → start one silently.
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("[auth] anonymous sign-in failed", err);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const setLanguage = useCallback(
    async (lang: LanguagePref) => {
      setProfile((p) => (p ? { ...p, languagePref: lang } : p));
      if (!user) return;
      try {
        await updateDoc(doc(db, "users", user.uid), {
          languagePref: lang,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("[auth] setLanguage failed", err);
      }
    },
    [user],
  );

  // Officer sign-in (C8). Replaces the current (anonymous) session with the staff account;
  // onAuthStateChanged then loads the seeded officer doc → profile.role flips to 'officer'.
  // A fresh email sign-in mints a token carrying the custom claims the seed set. Throws the
  // Firebase error so the login form can surface bad-credentials.
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email.trim(), password);
  }, []);

  // Phone-OTP anonymous-upgrade (C13). linkWithPhoneNumber links the phone credential to the
  // CURRENT anonymous user (same uid, no new account) → returns a ConfirmationResult; confirming
  // the OTP completes the upgrade. We then persist phone + isAnonymous:false + a seed trustScore
  // to users/{uid} (the rule allows non-role field updates) and reflect it in the local profile.
  const startPhoneUpgrade = useCallback(
    async (phone: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
      const u = getClientAuth().currentUser;
      if (!u) throw new Error("NOT_SIGNED_IN");
      return linkWithPhoneNumber(u, phone, verifier);
    },
    [],
  );

  const confirmPhoneOtp = useCallback(
    async (confirmation: ConfirmationResult, code: string): Promise<void> => {
      const cred = await confirmation.confirm(code);
      const u = cred.user;
      const phone = u.phoneNumber ?? null;
      await updateDoc(doc(db, "users", u.uid), {
        phone,
        isAnonymous: false,
        trustScore: 50,
        updatedAt: serverTimestamp(),
      });
      setProfile((p) => (p ? { ...p, isAnonymous: false, phone } : p));
    },
    [],
  );

  // Sign out → onAuthStateChanged fires null → the effect silently re-signs-in anonymously
  // (back to a citizen session).
  const signOut = useCallback(async () => {
    await firebaseSignOut(getClientAuth());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      setLanguage,
      signInWithEmail,
      startPhoneUpgrade,
      confirmPhoneOtp,
      signOut,
    }),
    [user, profile, loading, setLanguage, signInWithEmail, startPhoneUpgrade, confirmPhoneOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
