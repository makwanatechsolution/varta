import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope("profile");
googleAuthProvider.addScope("email");
googleAuthProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Initiates Google Sign-In via Firebase Auth redirect.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(firebaseAuth, googleAuthProvider);
}

/**
 * Initiates Google Sign-In via Firebase Auth popup.
 * Returns the Firebase user and idToken for use with our GCP backend.
 */
export async function signInWithGooglePopup(): Promise<{ user: FirebaseUser; idToken: string }> {
  const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

/**
 * Handles redirect result on page load after returning from Google OAuth redirect.
 * Returns user + idToken for our GCP backend to sync/create profile.
 */
export async function handleFirebaseGoogleRedirect(): Promise<{
  user: FirebaseUser;
  idToken: string;
} | null> {
  try {
    const result = await getRedirectResult(firebaseAuth);
    if (result && result.user) {
      const idToken = await result.user.getIdToken();
      return { user: result.user, idToken };
    }
  } catch (err: any) {
    console.error("Firebase Google Redirect Sign-In error:", err);
    throw err;
  }
  return null;
}

export { firebaseSignOut };

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return undefined;

  const params = new URLSearchParams(firebaseConfig as any).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);

  if (registration.active) {
    return registration;
  }

  const sw = registration.installing || registration.waiting;
  if (sw) {
    await new Promise<void>((resolve) => {
      sw.addEventListener("statechange", (e: any) => {
        if (e.target.state === "activated" || registration.active) {
          resolve();
        }
      });
      setTimeout(resolve, 2000);
    });
  }

  await navigator.serviceWorker.ready;
  return registration;
}

export async function requestPushPermission(_userId: string) {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const registration = await registerServiceWorker();
    if (!registration) return null;

    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Register token with our GCP backend (not Supabase)
      const { pushTokensApi } = await import("./api");
      await pushTokensApi.upsert(token, "web");
    }

    return token;
  } catch (err) {
    console.warn("Failed to subscribe to push notifications:", err);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: unknown) => void) {
  isSupported().then((supported) => {
    if (!supported) return;
    onMessage(getMessaging(firebaseApp), callback);
  });
}
