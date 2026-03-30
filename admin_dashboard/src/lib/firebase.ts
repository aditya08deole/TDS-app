import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTpjXpHh58NzARWkjX6-lM1m62gJBmWXY",
  authDomain: "evaratds.firebaseapp.com",
  projectId: "evaratds",
  storageBucket: "evaratds.firebasestorage.app",
  messagingSenderId: "138316765807",
  appId: "1:138316765807:web:b0ab674848d9871c354b9a",
  measurementId: "G-LDFW961S0Q"
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
