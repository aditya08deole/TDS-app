import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { storage } from './storage';

/**
 * Native Push Notification Handler — EvaraTDS Production
 * 
 * Handles FCM token registration, permission requests, and incoming
 * background/foreground alerts on Android.
 */

export const initPushNotifications = async () => {
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

  // On success, save the token to local storage so the App can send it to the backend
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('FCM Token generated:', token.value);
    await storage.set('fcm_token', token.value);
  });

  // Handle registration errors
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('FCM Registration Error:', JSON.stringify(error));
  });

  // Handle incoming notification while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push received in foreground:', notification);
    // You can trigger a custom UI toast here if needed
  });

  // Handle tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('Push action performed:', notification);
    // Navigate to a specific screen if needed
  });
};

/**
 * Get the stored FCM token for sending to backend
 */
export const getFCMToken = async (): Promise<string | null> => {
  return await storage.get('fcm_token');
};
