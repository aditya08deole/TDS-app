import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { storage } from './storage';

// Inline helper — reads VITE_BACKEND_URL (set in .env) or falls back to localhost
function getApiBaseUrl(): string {
    return (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001';
}

/**
 * Native Push Notification Handler — EvaraTDS Production
 *
 * Fix #18: After registering with Capacitor/FCM, the native token is now POSTed
 * to the backend at /api/notifications/register-token so the backend stores it
 * in the same `notification_subscriptions` Firestore collection used by web tokens.
 * This makes Android users receive push notifications from the backend engine.
 */

// Fix #18: POST native token to backend so it's stored alongside web FCM tokens
async function registerNativeTokenWithBackend(token: string, userId: string | null): Promise<void> {
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/notifications/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: 'android_native',
        userId: userId || 'unknown',
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('❌ Failed to register native FCM token with backend:', err);
    } else {
      console.log('✅ Native FCM token registered with backend.');
    }
  } catch (err) {
    console.error('❌ Network error registering native token:', err);
  }
}

export const initPushNotifications = async (userId?: string | null) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Skipping Push Notifications: Not on a native platform.');
    return;
  }

  // Request permissions
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.warn('Push Notification permission denied.');
    return;
  }

  // Register with FCM
  await PushNotifications.register();

  // On success, save the token locally AND register it with the backend
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('FCM Token generated:', token.value);
    await storage.set('fcm_token', token.value);
    // Fix #18: Send to backend so server-side push dispatch works for native Android
    await registerNativeTokenWithBackend(token.value, userId ?? null);
  });

  // Handle registration errors
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('FCM Registration Error:', JSON.stringify(error));
  });

  // Handle incoming notification while app is in foreground (show UI toast via event)
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push received in foreground:', notification);
    // NotificationContext foreground handler will show a toast via onMessage
  });

  // Handle tapping on a notification — navigate to alerts
  PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('Push action performed:', notification);
    const url = notification.notification?.data?.url;
    if (url && typeof window !== 'undefined') {
      window.location.href = url;
    }
  });
};

/**
 * Get the stored FCM token for sending to backend
 */
export const getFCMToken = async (): Promise<string | null> => {
  return await storage.get('fcm_token');
};
