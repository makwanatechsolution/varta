// Register before Firebase so our click handler owns notification navigation.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const destination = new URL(data.click_action || (data.conversationId ? `/chat/${encodeURIComponent(data.conversationId)}` : '/'), self.location.origin);
  if (destination.origin !== self.location.origin) return;
  event.stopImmediatePropagation();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === destination.origin);
    if (existing) {
      await existing.navigate(destination.href);
      return existing.focus();
    }
    return clients.openWindow(destination.href);
  })());
});
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
const params = new URL(self.location.href).searchParams;
const config = Object.fromEntries(['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'].map(key => [key, params.get(key)]));
if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  firebase.messaging().onBackgroundMessage(payload => {
    // Firebase displays notification payloads automatically; render data messages only.
    if (payload.notification) return;
    const data = payload.data || {};
    return self.registration.showNotification(data.title || 'Varta', {
      body: data.body || 'You have a new update', icon: '/varta-icon.png', badge: '/varta-icon.png',
      tag: data.callId || data.conversationId || 'varta-notification', data,
    });
  });
}
