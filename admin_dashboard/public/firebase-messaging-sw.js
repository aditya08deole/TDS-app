// ─── Smart Valve Firebase Messaging Service Worker ──────────────────────────────
// Handles background push notifications when the app tab is closed or hidden.
// This file is served from /public and injected with real env values at build time.
// For dev, the Vite dev-server middleware injects values at request time.
// ─────────────────────────────────────────────────────────────────────────────

// Fix #16: Upgraded from pinned 10.7.0 to latest stable 10.14.1
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Fix #2: Config is injected at build time by vite.config.ts inject-sw-config plugin.
// In dev, the Vite middleware replaces these placeholders before serving.
// If any key is empty, log clearly rather than silently failing.
const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
};

// Fix #2: Runtime validation — log clearly if any key is still a placeholder
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v || v.startsWith('__FIREBASE_'))
  .map(([k]) => k);

if (missingKeys.length > 0) {
  console.error(
    '[firebase-messaging-sw.js] ❌ MISSING CONFIG KEYS — background push will not work:',
    missingKeys.join(', ')
  );
} else {
  console.log('[firebase-messaging-sw.js] ✅ Firebase config loaded successfully.');
}

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Fix #1: onBackgroundMessage handles push when the tab is CLOSED or HIDDEN.
// This is what makes notifications work like WhatsApp/Instagram.
// The foreground handler (onMessage in NotificationContext) only runs when the app is open.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 📬 Background message received:', payload);

  const title = payload.notification?.title || '🚨 Smart Valve Alert';
  const location = payload.data?.location_name || payload.data?.deviceId || 'System';
  const ppm = payload.data?.ppm || '';
  const recordedAt = payload.data?.recorded_at || '';
  const severity = payload.data?.severity || 'critical';
  const isReminder = payload.data?.isReminder === 'true';

  const bodyParts = [];
  if (location) bodyParts.push(location);
  if (ppm) bodyParts.push(`${ppm} ppm`);
  if (recordedAt) bodyParts.push(recordedAt);

  const body = bodyParts.length > 0
    ? bodyParts.join(' • ')
    : (payload.notification?.body || 'A new alert has been triggered.');

  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    // tag groups alerts per device — replaces old notification instead of stacking
    tag: payload.data?.alertId || `smartvalve-${payload.data?.deviceId || 'alert'}`,
    renotify: true,
    requireInteraction: severity === 'critical' && !isReminder,
    data: {
      url: payload.data?.url || '/alerts',
      alertId: payload.data?.alertId || '',
    },
    actions: [
      { action: 'view', title: '📊 View Alert' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(title, options);
});

// Handle notification click — open the app to the alerts page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/alerts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});
