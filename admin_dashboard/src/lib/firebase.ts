import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Utility to safely access environment variables
const getEnv = (key: string): string => {
  return (import.meta.env[key] as string) || "";
};

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics - guarded: can fail on localhost or in non-browser environments
let analytics: any = null;
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

export { app, analytics, auth, db, storage };
export default app;
