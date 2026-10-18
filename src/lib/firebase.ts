import { initializeApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, onMessage, isSupported, type MessagePayload } from "firebase/messaging";
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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyACrSOGWT7bdCLNdJvD1UijODymlQxKcb8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "chatapp-varta.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "chatapp-varta",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "513968664368",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:513968664368:web:d20d6a0be682ef57c062f5",
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
let googleRedirectResult: Promise<{ user: FirebaseUser; idToken: string } | null> | undefined;
export function handleFirebaseGoogleRedirect(): Promise<{ user: FirebaseUser; idToken: string } | null> {
  // React StrictMode mounts twice; consume the redirect result only once.
  googleRedirectResult ??= getRedirectResult(firebaseAuth).then(async result => {
    if (!result) return null;
    return { user: result.user, idToken: await result.user.getIdToken() };
  });
  return googleRedirectResult;
}

export { firebaseSignOut };

let registeredPushToken: string | null = null;

async function registerServiceWorker() {
  const params = new URLSearchParams(firebaseConfig).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`, { scope: "/", updateViaCache: "none" });
  if (!registration.active) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      const timeout = setTimeout(() => reject(new Error("Notification setup timed out. Please retry.")), 15000);
      const check = () => {
        if (registration.active || worker?.state === "activated") { clearTimeout(timeout); resolve(); }
        else if (worker?.state === "redundant") { clearTimeout(timeout); reject(new Error("Notification service could not start.")); }
      };
      worker?.addEventListener("statechange", check);
      check();
    });
  }
  return registration;
}

export async function requestPushPermission(userId: string, askPermission = true): Promise<string | null> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.isSecureContext) {
    if (askPermission) throw new Error("Notifications need a supported browser and HTTPS. On iPhone, open Varta from your Home Screen.");
    return null;
  }
  // Keep permission requests directly inside the button gesture, before any awaits.
  const permission = Notification.permission === "default" && askPermission
    ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") {
    if (askPermission) throw new Error(permission === "denied" ? "Notifications are blocked. Allow them in your browser's site settings, then retry." : "Allow notifications to receive message and call alerts.");
    return null;
  }
  if (!(await isSupported())) throw new Error("Push notifications are not supported in this browser.");
  const registration = await registerServiceWorker();
  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || "BK8TZC-7gexGHsrcE33zfm6d5hYYbatTEUFMHB61RjxLKInRTWtYNaMueuGTHEafwYxtmn47eUnAgmSaJ98u8cA",
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Could not register this device. Please retry.");
  if (firebaseAuth.currentUser?.uid !== userId) return null;
  const { pushTokensApi } = await import("./api");
  const { error } = await pushTokensApi.upsert(token, "web");
  if (error) throw new Error(`Could not connect notifications: ${error}`);
  registeredPushToken = token;
  return token;
}

export async function removePushRegistration() {
  if (!registeredPushToken) return;
  const { pushTokensApi } = await import("./api");
  const { error } = await pushTokensApi.remove(registeredPushToken);
  if (error) throw new Error(error);
  await deleteToken(getMessaging(firebaseApp));
  registeredPushToken = null;
}

export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | undefined;
  isSupported().then((supported) => {
    if (supported && !disposed) unsubscribe = onMessage(getMessaging(firebaseApp), callback);
  }).catch(console.warn);
  return () => { disposed = true; unsubscribe?.(); };
}
