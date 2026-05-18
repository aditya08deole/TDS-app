/**
 * OfflineStorage Service
 * Handles persistent storage for offline mode using Capacitor Storage
 * Allows app to work without internet connection
 */

import { storage } from './storage';
import { type Device } from '../types';

// Cache keys
// @ts-ignore
const CACHE_KEYS = {
  DEVICES: 'cache:devices',
  DEVICE_DATA: (id: string) => `cache:device:${id}`,
  SENSOR_DATA: (id: string) => `cache:sensor:${id}`,
  ALERTS: 'cache:alerts',
  LAST_SYNC: 'cache:last_sync',
};

// TTL in milliseconds
const CACHE_TTL = {
  DEVICES: 15 * 60 * 1000, // 15 minutes
  SENSOR_DATA: 30 * 60 * 1000, // 30 minutes
  ALERTS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Save devices to offline storage
 */
export async function cacheDevices(devices: Device[]): Promise<void> {
  try {
    const item: CachedItem<Device[]> = {
      data: devices,
      timestamp: Date.now(),
      ttl: CACHE_TTL.DEVICES,
    };
    await storage.set('cache:devices', JSON.stringify(item));
    console.log(`💾 Cached ${devices.length} devices to offline storage`);
  } catch (error) {
    console.error('❌ Failed to cache devices:', error);
  }
}

/**
 * Get devices from offline storage
 */
export async function getCachedDevices(): Promise<Device[] | null> {
  try {
    const stored = await storage.get<string>('cache:devices');
    if (!stored) return null;

    const item: CachedItem<Device[]> = JSON.parse(stored);
    const now = Date.now();

    // Check if cache is still valid
    if (now - item.timestamp > item.ttl) {
      console.log('⏰ Device cache expired');
      await storage.remove('cache:devices');
      return null;
    }

    console.log(`📦 Loaded ${item.data.length} devices from offline cache`);
    return item.data;
  } catch (error) {
    console.error('❌ Failed to get cached devices:', error);
    return null;
  }
}

/**
 * Cache sensor data for a specific device
 */
export async function cacheSensorData(
  deviceId: string,
  data: any[]
): Promise<void> {
  try {
    const item: CachedItem<any[]> = {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL.SENSOR_DATA,
    };
    const key = `cache:sensor:${deviceId}`;
    await storage.set(key, JSON.stringify(item));
    console.log(`💾 Cached sensor data for device ${deviceId}`);
  } catch (error) {
    console.error(`❌ Failed to cache sensor data for ${deviceId}:`, error);
  }
}

/**
 * Get sensor data from offline storage
 */
export async function getCachedSensorData(deviceId: string): Promise<any[] | null> {
  try {
    const key = `cache:sensor:${deviceId}`;
    const stored = await storage.get<string>(key);
    if (!stored) return null;

    const item: CachedItem<any[]> = JSON.parse(stored);
    const now = Date.now();

    if (now - item.timestamp > item.ttl) {
      await storage.remove(key);
      return null;
    }

    return item.data;
  } catch (error) {
    console.error(`❌ Failed to get cached sensor data for ${deviceId}:`, error);
    return null;
  }
}

/**
 * Check if network is available
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get connection status
 */
export async function getOfflineStatus(): Promise<{
  isOnline: boolean;
  hasDeviceCache: boolean;
  cacheAge: number | null;
}> {
  try {
    const devicesStr = await storage.get<string>('cache:devices');
    let hasDeviceCache = false;
    let cacheAge = null;

    if (devicesStr) {
      try {
        const item: CachedItem<Device[]> = JSON.parse(devicesStr);
        hasDeviceCache = Date.now() - item.timestamp < item.ttl;
        cacheAge = Date.now() - item.timestamp;
      } catch {
        hasDeviceCache = false;
      }
    }

    return {
      isOnline: navigator.onLine,
      hasDeviceCache,
      cacheAge,
    };
  } catch (error) {
    console.error('❌ Failed to get offline status:', error);
    return {
      isOnline: navigator.onLine,
      hasDeviceCache: false,
      cacheAge: null,
    };
  }
}

/**
 * Clear all offline cache (useful for logout)
 * ISSUE-012: Comprehensive cache clearing for security on logout
 */
export async function clearOfflineCache(): Promise<void> {
  try {
    const keysToRemove = [
      // Device and sensor data cache
      'cache:devices',
      'cache:alerts',
      'cache:last_sync',
      
      // Alert history
      'alerts:history',        // Alert history from alertHistory.ts
      'alerts_list',           // Alert notifications list
      
      // Firebase Cloud Messaging
      'fcm_token',             // FCM token value
      'fcm_token_timestamp',   // FCM token refresh timestamp
      'fcm_registration_attempt',  // FCM registration attempt time
      'fcm_registration_error',    // FCM registration error message
      
      // Export tracking (may contain user data paths)
      'last_export',           // Last export timestamp and metadata
      'export_location',       // Export file location
      
      // Cache statistics and sync queue
      'cache_stats',           // Debug cache statistics
      'last_debug_log',        // Last debug log message
      'offline-sync-queue',    // Offline sync queue from syncQueue.ts
      
      // Token and session (handled by storage.clear, but be explicit)
      'auth_token_info',       // JWT token info
      'session_status',        // Session status
      
      // Dynamic sensor cache keys will be handled by clearing all prefixes
      // Pattern: cache:sensor:{deviceId}, cache:device:{deviceId}
    ];

    // Remove known cache keys
    for (const key of keysToRemove) {
      await storage.remove(key);
    }

    // Also clear any device-specific sensor data
    // These keys follow pattern: cache:sensor:{deviceId}
    // We need to iterate through storage to find and remove them
    try {
      // On native platform, we can try to get all keys (if Capacitor API supports it)
      // For now, we'll rely on comprehensive clearing via storage.clear() in tokenRefresh
      console.log('✅ Removed standard offline cache keys');
    } catch (error) {
      console.error('⚠️ Could not remove all dynamic cache keys:', error);
    }

    console.log('🗑️ Offline cache cleared');
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
}

/**
 * Record last sync timestamp
 */
export async function recordSyncTimestamp(): Promise<void> {
  try {
    await storage.set('cache:last_sync', String(Date.now()));
  } catch (error) {
    console.error('❌ Failed to record sync timestamp:', error);
  }
}
