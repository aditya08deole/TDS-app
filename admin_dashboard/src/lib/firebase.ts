import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, type Messaging } from "firebase/messaging";
import { type Analytics } from "firebase/analytics";

// Utility to safely access environment variables
const getEnv = (key: string): string => {
  return (import.meta.env[key] as string) || "";
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};

const app = initializeApp(firebaseConfig);

// Analytics — lazy-loaded to prevent SSR/localhost failures
let analytics: Analytics | null = null;
try {
  if (typeof window !== 'undefined') {
    import('firebase/analytics').then(({ getAnalytics }) => {
      analytics = getAnalytics(app);
    }).catch(() => {
      console.warn('Firebase Analytics not available (expected on localhost)');
    });
  }
} catch {
  console.warn('Firebase Analytics initialization skipped');
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ── Messaging: Synchronous initialization to avoid race conditions ──────────
// The old async `isSupported()` pattern caused `messaging` to be null at
// component mount time because the Promise resolved after effects ran.
// We now initialize synchronously and catch the error if FCM is unavailable
// (e.g., in non-HTTPS environments or Firefox without push support).
let messaging: Messaging | null = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn('Firebase Messaging not available in this environment:', err);
  }
}

export { app, analytics, auth, db, storage, messaging };
export default app;
