import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    const params = new URLSearchParams(firebaseConfig as any).toString();
    return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);
  }
  return undefined;
}

export async function requestPushPermission(userId: string) {
  const supported = await isSupported();
  if (!supported) return null;

  const messaging = getMessaging(firebaseApp);
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: await registerServiceWorker(),
  });

  if (token) {
    const { supabase } = await import("./supabase");
    await supabase.from("push_tokens").upsert(
      { user_id: userId, token, platform: "web" },
      { onConflict: "user_id,token" },
    );
  }

  return token;
}

export function onForegroundMessage(callback: (payload: unknown) => void) {
  isSupported().then((supported) => {
    if (!supported) return;
    onMessage(getMessaging(firebaseApp), callback);
  });
}
