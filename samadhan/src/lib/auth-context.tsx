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

// Client-facing slice of users/{uid} (data-shapes.md §2).
export type CitizenProfile = {
  uid: string;
  role: "citizen" | "officer" | "admin";
  displayName: string;
  isAnonymous: boolean;
  languagePref: LanguagePref;
  fcmTokens: string[];
};

type AuthState = {
  user: User | null;
  profile: CitizenProfile | null;
  loading: boolean;
  setLanguage: (lang: LanguagePref) => Promise<void>;
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
    languagePref: (data.languagePref as LanguagePref) ?? "en",
    fcmTokens: (data.fcmTokens as string[]) ?? [],
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

  const value = useMemo<AuthState>(
    () => ({ user, profile, loading, setLanguage }),
    [user, profile, loading, setLanguage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
