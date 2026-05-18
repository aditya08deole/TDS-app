/**
 * Platform Detection Utility
 * Detects if app is running on native (mobile) or web platform
 */

import { Capacitor } from '@capacitor/core';

/**
 * Check if running on native platform (iOS/Android)
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if running on web
 */
export function isWebApp(): boolean {
  return !Capacitor.isNativePlatform();
}

/**
 * Get current platform
 */
export function getPlatform(): 'web' | 'ios' | 'android' {
  if (!Capacitor.isNativePlatform()) return 'web';
  return Capacitor.getPlatform() as 'ios' | 'android';
}

/**
 * Check if on mobile device (native)
 */
export function isMobileDevice(): boolean {
  return isNativeApp();
}

/**
 * Check if on desktop (web)
 */
export function isDesktop(): boolean {
  return isWebApp();
}

/**
 * Check if Android specifically
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

/**
 * Check if iOS specifically
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * Get device info for debugging
 */
export function getDeviceInfo() {
  return {
    platform: getPlatform(),
    isNative: isNativeApp(),
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    userAgent: navigator.userAgent,
    online: navigator.onLine,
  };
}

/**
 * Log device info for debugging
 */
export function logDeviceInfo(): void {
  const info = getDeviceInfo();
  console.group('📱 Device Info');
  console.log('Platform:', info.platform);
  console.log('Is Native:', info.isNative);
  console.log('Is Android:', info.isAndroid);
  console.log('Is iOS:', info.isIOS);
  console.log('Online:', info.online);
  console.log('User Agent:', info.userAgent);
  console.groupEnd();
}
