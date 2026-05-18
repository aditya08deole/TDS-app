import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { storage } from './storage';
import { getApiBaseUrl } from './remoteConfig';

/**
 * Native Push Notification Handler — EvaraTDS Production
 *
 * Fix #18: After registering with Capacitor/FCM, the native token is now POSTed
 * to the backend at /api/notifications/register-token so the backend stores it
 * in the same `notification_subscriptions` Firestore collection used by web tokens.
 * This makes Android users receive push notifications from the backend engine.
 */

// Fix #18: POST native token to backend so it's stored alongside web FCM tokens
// Fix #22: Ensure token is registered AFTER user is authenticated
async function registerNativeTokenWithBackend(token: string, userId: string | null, maxRetries: number = 3): Promise<void> {
  if (!userId || userId === 'unknown' || userId === 'anonymous') {
    console.warn('[FCM-REGISTER] ⏳ User not authenticated yet - token registration deferred');
    // Store token for later registration
    const { storage } = await import('./storage');
    await storage.set('fcm_pending_token', token);
    return;
  }

  try {
    const { storage } = await import('./storage');
    const base = getApiBaseUrl();
    
    // Log attempt
    const attemptTime = new Date().toISOString();
    await storage.set('fcm_registration_attempt', attemptTime);
    
    console.log(`[FCM-REGISTER] POST ${base}/api/notifications/register-token`);
    console.log(`[FCM-REGISTER] Token: ${token.substring(0, 20)}... (length: ${token.length})`);
    console.log(`[FCM-REGISTER] User: ${userId}`);
    console.log(`[FCM-REGISTER] Platform: android_native`);
    
    const res = await fetch(`${base}/api/notifications/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.trim(),
        platform: 'android_native',
        userId: String(userId).trim(),
        userAgent: navigator.userAgent,
      }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errMsg = `Registration failed: ${res.status} - ${err.error || 'Unknown error'}`;
      console.error('❌ ' + errMsg);
      await storage.set('fcm_registration_error', errMsg);
      
      // Retry on network failure
      if (maxRetries > 0 && res.status >= 500) {
        console.log(`[FCM-REGISTER] Retrying in 5 seconds... (${maxRetries} retries left)`);
        setTimeout(() => registerNativeTokenWithBackend(token, userId, maxRetries - 1), 5000);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      console.log('✅ Native FCM token registered with backend.');
      console.log(`[FCM-REGISTER] Response: ${JSON.stringify(data)}`);
      await storage.set('fcm_registration_error', ''); // Clear error
      await storage.set('fcm_token_timestamp', attemptTime); // Mark success
      await storage.set('fcm_pending_token', ''); // Clear pending
    }
  } catch (err: any) {
    const errMsg = `Network error: ${err?.message || String(err)}`;
    console.error('❌ ' + errMsg);
    const { storage } = await import('./storage');
    await storage.set('fcm_registration_error', errMsg);
  }
}

export const initPushNotifications = async (userId?: string | null) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Skipping Push Notifications: Not on a native platform.');
    return;
  }

  console.log(`[FCM-INIT] Starting on ${Capacitor.getPlatform()}...`);

  // Create notification channel for Android (Fix #19)
  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'evara_alerts',
        name: 'EvaraTDS Alerts',
        description: 'Critical water quality alerts',
        importance: 5, // High/Urgent
        visibility: 1, // Public
        vibration: true,
        lights: true,
        lightColor: '#ff0055'
      });
      console.log('[FCM-INIT] Notification channel "evara_alerts" created.');
    } catch (err) {
      console.error('[FCM-INIT] Failed to create notification channel:', err);
    }
  }

  // Request permissions
  let permStatus = await PushNotifications.checkPermissions();
  console.log(`[FCM-INIT] Permission status: ${JSON.stringify(permStatus)}`);

  if (permStatus.receive === 'prompt') {
    console.log('[FCM-INIT] Requesting notification permission from user...');
    permStatus = await PushNotifications.requestPermissions();
    console.log(`[FCM-INIT] Permission after request: ${JSON.stringify(permStatus)}`);
  }

  if (permStatus.receive !== 'granted') {
    console.warn('❌ Push Notification permission denied.');
    await storage.set('fcm_registration_error', 'Permission denied by user');
    return;
  }

  console.log('[FCM-INIT] Registering with FCM...');
  // Register with FCM
  await PushNotifications.register();

  // On success, save the token locally AND register it with the backend
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log(`✅ [FCM-TOKEN] Generated: ${token.value.substring(0, 20)}...`);
    await storage.set('fcm_token', token.value);
    // Fix #18: Send to backend so server-side push dispatch works for native Android
    await registerNativeTokenWithBackend(token.value, userId ?? null);
  });

  // Handle registration errors
  PushNotifications.addListener('registrationError', (error: any) => {
    const errMsg = JSON.stringify(error);
    console.error(`❌ [FCM-ERROR] ${errMsg}`);
    storage.set('fcm_registration_error', errMsg);
  });

  // Handle incoming notification while app is in foreground (show UI toast via event)
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('📬 [FCM-RECEIVED] Push received in foreground:', notification);
    // NotificationContext foreground handler will show a toast via onMessage
  });

  // Handle tapping on a notification — navigate to alerts
  PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('👆 [FCM-ACTION] Push action performed:', notification);
    const url = notification.notification?.data?.url;
    if (url && typeof window !== 'undefined') {
      console.log(`[FCM-ACTION] Navigating to ${url}`);
      window.location.href = url;
    }
  });
  
  console.log('[FCM-INIT] Push notification initialization complete.');
};

/**
 * Get the stored FCM token for sending to backend
 */
export const getFCMToken = async (): Promise<string | null> => {
  return await storage.get('fcm_token');
};

/**
 * Fix #22: Retry registering pending tokens when user authenticates
 */
export const retryPendingTokenRegistration = async (userId: string | null): Promise<void> => {
  if (!userId) return;
  
  try {
    const pendingToken = await storage.get('fcm_pending_token');
    if (pendingToken) {
      console.log('[FCM-REGISTER] 🔄 Retrying pending token registration now that user is authenticated');
      await registerNativeTokenWithBackend(pendingToken, userId);
    }
  } catch (err) {
    console.error('[FCM-REGISTER] Error retrying pending token:', err);
  }
};
