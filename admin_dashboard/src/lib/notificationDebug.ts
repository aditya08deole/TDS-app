/**
 * Debug utilities for FCM notification registration and delivery
 * Used to diagnose notification issues on mobile
 *
 * Fix #7: Verify notification registration and delivery
 */

import { Capacitor } from '@capacitor/core';
// import { PushNotifications } from '@capacitor/push-notifications';
import { storage } from './storage';

export interface NotificationDebugInfo {
    platform: string;
    fcmToken: string | null;
    fcmTokenTimestamp: string | null;
    lastRegistrationAttempt: string | null;
    registrationError: string | null;
    isPushEnabled: boolean;
    isNativeApp: boolean;
}

/**
 * Get comprehensive notification debug info
 */
export async function getNotificationDebugInfo(): Promise<NotificationDebugInfo> {
    const fcmToken = await storage.get('fcm_token');
    const fcmTimestamp = await storage.get('fcm_token_timestamp');
    const lastAttempt = await storage.get('fcm_registration_attempt');
    const lastError = await storage.get('fcm_registration_error');
    
    return {
        platform: Capacitor.getPlatform(),
        fcmToken: fcmToken,
        fcmTokenTimestamp: fcmTimestamp,
        lastRegistrationAttempt: lastAttempt,
        registrationError: lastError,
        isPushEnabled: fcmToken ? true : false,
        isNativeApp: Capacitor.isNativePlatform(),
    };
}

/**
 * Log debug info to browser console and storage
 */
export async function logNotificationDebug(prefix: string = '[FCM-DEBUG]'): Promise<void> {
    const debugInfo = await getNotificationDebugInfo();
    
    const message = `
${prefix}
Platform: ${debugInfo.platform}
Is Native: ${debugInfo.isNativeApp}
FCM Enabled: ${debugInfo.isPushEnabled}
FCM Token: ${debugInfo.fcmToken ? debugInfo.fcmToken.substring(0, 20) + '...' : 'NONE'}
Token Timestamp: ${debugInfo.fcmTokenTimestamp || 'UNKNOWN'}
Last Attempt: ${debugInfo.lastRegistrationAttempt || 'NEVER'}
Last Error: ${debugInfo.registrationError || 'NONE'}
    `.trim();
    
    console.log(message);
    
    // Store in session for debugging
    await storage.set('last_debug_log', message);
}

/**
 * Verify FCM token is registered with backend
 */
export async function verifyBackendRegistration(): Promise<{ success: boolean; error?: string }> {
    try {
        const fcmToken = await storage.get('fcm_token');
        if (!fcmToken) {
            return { success: false, error: 'No FCM token found' };
        }
        
        const baseUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/notifications/verify-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: fcmToken }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, error: data.error || 'Backend verification failed' };
        }
        
        console.log('✅ [FCM] Backend verified token registration');
        return { success: true };
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error('❌ [FCM] Backend verification failed:', msg);
        return { success: false, error: msg };
    }
}

/**
 * Simulate a test notification (calls backend endpoint)
 */
export async function triggerTestNotification(): Promise<{ success: boolean; error?: string }> {
    try {
        const fcmToken = await storage.get('fcm_token');
        if (!fcmToken) {
            return { success: false, error: 'No FCM token - cannot send test' };
        }
        
        const baseUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/notifications/test-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: fcmToken,
                message: 'Test notification from app' 
            }),
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return { success: false, error: error.error || 'Test failed' };
        }
        
        console.log('✅ [FCM] Test notification sent to backend');
        return { success: true };
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error('❌ [FCM] Test notification failed:', msg);
        return { success: false, error: msg };
    }
}

/**
 * Export debug info as JSON string
 */
export async function exportDebugInfo(): Promise<string> {
    const info = await getNotificationDebugInfo();
    return JSON.stringify(info, null, 2);
}
