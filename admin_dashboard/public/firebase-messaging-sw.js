importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "__APIKEY__",
  authDomain: "__AUTHDOMAIN__",
  projectId: "__PROJECTID__",
  storageBucket: "__STORAGEBUCKET__",
  messagingSenderId: "__MESSAGINGSENDERID__",
  appId: "__APPID__",
  measurementId: "__MEASUREMENTID__"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
