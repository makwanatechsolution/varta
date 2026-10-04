import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import { firebaseAuth, firebaseSignOut } from "../lib/firebase";
import { profilesApi } from "../lib/api";
import type { Profile } from "../types/database";

export interface AuthUser extends FirebaseUser {
  id: string;
}

interface AuthContextValue {
  /** Firebase user — null when signed out */
  user: AuthUser | null;
  /** Backend profile record */
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const { data, error } = await profilesApi.getMe();
      if (data) {
        setProfile(data as Profile);
      } else {
        console.warn("fetchProfile error:", error);
      }
    } catch (err) {
      console.warn("fetchProfile failed:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        Object.defineProperty(firebaseUser, "id", { get: () => firebaseUser.uid, configurable: true });
        setUser(firebaseUser as AuthUser);
        // Give API client a moment to pick up the new token
        await fetchProfile();
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    // onAuthStateChanged will trigger fetchProfile
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    // Set display name in Firebase
    await updateProfile(cred.user, { displayName });
    // Backend will auto-create profile on first /api/profiles/me call
    // Notify admin of new signup
    try {
      await fetch("/api/notifyAdminSignup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: displayName }),
      });
    } catch (err) {
      console.warn("Failed to send admin notification:", err);
    }
  };

  const signOut = async () => {
    try {
      await profilesApi.updatePresence("offline");
    } catch { /* best effort */ }
    await firebaseSignOut(firebaseAuth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth, email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile: fetchProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
