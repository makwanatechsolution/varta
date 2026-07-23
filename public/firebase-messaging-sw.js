// Scripts for Firebase Cloud Messaging in the background.
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 1. Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// Note: We use query params added during SW registration to pass the config,
// but since FCM SW must be named exactly this and typically served statically,
// a common pattern is to either hardcode the config here, or use URL params
// when calling navigator.serviceWorker.register.

const firebaseConfig = {
  apiKey: "AIzaSyACrSOGWT7bdCLNdJvD1UijODymlQxKcb8",
  authDomain: "chatapp-varta.firebaseapp.com",
  projectId: "chatapp-varta",
  storageBucket: "chatapp-varta.firebasestorage.app",
  messagingSenderId: "513968664368",
  appId: "1:513968664368:web:d20d6a0be682ef57c062f5",
  measurementId: "G-BXB9B863BX"
};

// Initialize Firebase

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const title = payload.notification?.title || payload.data?.title || payload.data?.senderName || 'Varta';
    const body = payload.notification?.body || payload.data?.body || payload.data?.preview || 'New message received';
    const icon = payload.notification?.icon || payload.data?.icon || `${self.location.origin}/favicon.svg`;

    const notificationOptions = {
      body: body,
      icon: icon,
      badge: `${self.location.origin}/favicon.svg`,
      tag: payload.data?.conversationId || 'varta-push',
      data: payload.data || {},
    };

    self.registration.showNotification(title, notificationOptions);
  });
}

// Fallback native Push event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Native push event received: ', payload);

    const title = payload.notification?.title || payload.data?.title || payload.data?.senderName || 'Varta';
    const body = payload.notification?.body || payload.data?.body || payload.data?.preview || 'New message received';
    const icon = payload.notification?.icon || payload.data?.icon || `${self.location.origin}/favicon.svg`;

    const notificationOptions = {
      body: body,
      icon: icon,
      badge: `${self.location.origin}/favicon.svg`,
      tag: payload.data?.conversationId || 'varta-push',
      data: payload.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(title, notificationOptions)
    );
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Could not parse push payload as JSON:', err);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const clickAction = event.notification.data?.click_action;
  if (clickAction) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(clickAction) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(clickAction);
        }
      })
    );
  }
});
