import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  firebaseAuth,
  firebaseSignOut,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
  handleFirebaseGoogleRedirect,
} from "../lib/firebase";
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
  signInWithGoogle: () => Promise<AuthUser | null>;
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
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;
    const { data, error } = await profilesApi.getMe();
    if (firebaseAuth.currentUser !== currentUser) return;
    if (data) setProfile(data as Profile);
    else console.warn("[Auth] Profile unavailable:", error);
  };

  useEffect(() => {
    let active = true;
    handleFirebaseGoogleRedirect().catch(console.warn);
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setProfile(null);
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      Object.defineProperty(firebaseUser, "id", { get: () => firebaseUser.uid, configurable: true });
      setUser(firebaseUser as AuthUser);
      setLoading(true);
      try {
        const { data, error } = await profilesApi.getMe();
        if (active && firebaseAuth.currentUser === firebaseUser) {
          if (data) setProfile(data as Profile);
          else console.warn("[Auth] Profile unavailable:", error);
        }
      } finally {
        if (active && firebaseAuth.currentUser === firebaseUser) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signInWithGoogle = async (): Promise<AuthUser | null> => {
    setLoading(true);
    try {
      let firebaseUser: FirebaseUser | null = null;
      try {
        const res = await signInWithGooglePopup();
        firebaseUser = res.user;
      } catch (popupErr: any) {
        if (popupErr?.code === "auth/popup-closed-by-user" || popupErr?.code === "auth/cancelled-popup-request") {
          setLoading(false);
          throw popupErr;
        }
        console.warn("[Auth] Popup sign-in failed, falling back to redirect:", popupErr);
        await signInWithGoogleRedirect();
        return null;
      }

      if (firebaseUser) {
        Object.defineProperty(firebaseUser, "id", { get: () => firebaseUser!.uid, configurable: true });
        const authUser = firebaseUser as AuthUser;
        return authUser;
      }
      return null;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(cred.user, { displayName });
      await profilesApi.update({ display_name: displayName });
    } catch (err) {
      setLoading(false);
      throw err;
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
        signInWithGoogle,
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
