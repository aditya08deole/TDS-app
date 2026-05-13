import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { messaging, db, auth } from '../lib/firebase';

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

/**
 * Silently refreshes the FCM registration token in Firestore whenever the
 * app mounts and the user has already granted notification permission.
 *
 * ⚠️  This hook does NOT prompt for permission — that is the responsibility
 * of `NotificationContext.subscribe()` which is triggered by deliberate
 * user action (e.g., clicking the "Enable Alerts" button in Settings).
 *
 * Design notes:
 * - Uses a deterministic Firestore doc ID (`{uid}_{tokenHash}`) so this is
 *   an idempotent upsert — zero extra reads, no duplicates.
 * - Supports multi-device: each device gets its own subscription doc.
 */
export const useNotifications = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !messaging) return;
    if (Notification.permission !== 'granted') return;

    const refreshToken = async () => {
      try {
        const token = await getToken(messaging!, { vapidKey: VAPID_KEY });
        if (!token) return;

        const user = auth.currentUser;
        if (!user) return;

        // Build a stable, deterministic doc ID from user + token fingerprint.
        const tokenHash = btoa(token).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
        const docId = `${user.uid}_${tokenHash}`;

        await setDoc(doc(db, 'notification_subscriptions', docId), {
          user_id: user.uid,
          token,
          platform: 'web_pwa',
          userAgent: navigator.userAgent,
          updated_at: serverTimestamp(),
        }, { merge: true });

        console.log('🔄 FCM token refreshed silently');
      } catch (err) {
        // Silent fail — user will be re-prompted via NotificationContext.subscribe()
        console.warn('Silent FCM token refresh failed:', err);
      }
    };

    refreshToken();
  }, []); // Run once on mount — no permission dialog
};
