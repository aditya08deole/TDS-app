// Give the service worker access to Firebase Messaging.
// Note: These are standard imports for Firebase v9+ in service workers.
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// These values are public and safe to include in a service worker file.
firebase.initializeApp({
  apiKey: "AIzaSyBTpjXpHh58NzARWkjX6-lM1m62gJBmWXY",
  authDomain: "evaratds.firebaseapp.com",
  projectId: "evaratds",
  storageBucket: "evaratds.firebasestorage.app",
  messagingSenderId: "138316765807",
  appId: "1:138316765807:web:b0ab674848d9871c354b9a"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png', // Corrected icon path
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
