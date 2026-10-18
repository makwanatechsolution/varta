import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  removePushRegistration,
  signInWithGooglePopup,
  handleFirebaseGoogleRedirect,
} from "../lib/firebase";
import { createAuthSession } from "../lib/authSession";
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
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const session = useRef<ReturnType<typeof createAuthSession<AuthUser, Profile>> | null>(null);

  const toAuthUser = (firebaseUser: FirebaseUser): AuthUser => {
    Object.defineProperty(firebaseUser, "id", { get: () => firebaseUser.uid, configurable: true });
    return firebaseUser as AuthUser;
  };

  const fetchProfile = async () => {
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) await session.current?.restore(toAuthUser(currentUser), true);
  };

  useEffect(() => {
    let active = true;
    const controller = createAuthSession<AuthUser, Profile>({
      currentUser: () => firebaseAuth.currentUser,
      loadProfile: async () => {
        const { data, error } = await profilesApi.getMe();
        if (error) throw new Error(error);
        if (!data?.id) throw new Error("Your account profile was not returned by the server. Please retry.");
        if (data.id !== firebaseAuth.currentUser?.uid) throw new Error("The server returned a different account profile. Please retry.");
        return data as Profile;
      },
      publish: state => {
        setUser(state.user); setProfile(state.profile); setLoading(state.loading); setError(state.error);
      },
    });
    session.current = controller;
    // Both sources use one coordinator; neither can overwrite a newer account.
    const unsubscribe = onAuthStateChanged(firebaseAuth, firebaseUser => {
      controller.restore(firebaseUser ? toAuthUser(firebaseUser) : null);
    }, authError => {
      if (active) { setError(authError.message); setLoading(false); }
    });
    handleFirebaseGoogleRedirect().then(result => {
      if (active && result?.user && firebaseAuth.currentUser?.uid === result.user.uid) controller.restore(toAuthUser(result.user));
    }).catch(redirectError => {
      if (active && !firebaseAuth.currentUser) { setError(redirectError.message || "Google sign-in did not complete. Please try again."); setLoading(false); }
    });
    return () => { active = false; controller.dispose(); unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    await session.current?.restore(toAuthUser(credential.user));
  };

  const signInWithGoogle = async (): Promise<AuthUser | null> => {
    setError(null);
    // Keep the popup tied to the click. Redirect fallback can lose the session
    // when the auth domain's storage is blocked by the browser.
    const result = await signInWithGooglePopup();
    const authUser = toAuthUser(result.user);
    await session.current?.restore(authUser);
    return authUser;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(cred.user, { displayName });
      const { error } = await profilesApi.update({ display_name: displayName });
      if (error) throw new Error(error);
      await fetchProfile();
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    await removePushRegistration().catch(console.warn);
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
        error,
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
