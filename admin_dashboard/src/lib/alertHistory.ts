/**
 * Alert History Storage Service
 * Persists alerts to phone storage even when app is closed
 * Keeps rolling 30-day history for offline access
 */

import { storage } from './storage';

export interface PersistedAlert {
  id: string;
  device_id: string;
  device_name?: string;
  message: string;
  severity: 'info' | 'critical' | 'warning' | 'high';
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  escalation_level?: number;
  savedAt: number; // When saved to phone storage
  read: boolean; // Whether user has seen it
}

const ALERTS_STORAGE_KEY = 'alerts:history';
const MAX_ALERT_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ALERTS_STORED = 500; // Don't store more than this

/**
 * Save alert to phone storage
 */
export async function saveAlert(alert: Omit<PersistedAlert, 'savedAt' | 'read'>): Promise<void> {
  try {
    const alerts = await loadAlerts();

    // Add new alert
    const newAlert: PersistedAlert = {
      ...alert,
      savedAt: Date.now(),
      read: false,
    };

    alerts.unshift(newAlert); // Add to beginning

    // Keep only last 30 days and max 500
    const now = Date.now();
    const filtered = alerts
      .filter(a => now - a.savedAt < MAX_ALERT_AGE)
      .slice(0, MAX_ALERTS_STORED);

    await storage.set(ALERTS_STORAGE_KEY, JSON.stringify(filtered));
    console.log(`💾 Alert saved to phone storage (${filtered.length} total)`);
  } catch (error) {
    console.error('❌ Failed to save alert:', error);
  }
}

/**
 * Load all alerts from phone storage
 * ISSUE-002: Sync alert history from API on first load
 */
export async function loadAlerts(): Promise<PersistedAlert[]> {
  try {
    const stored = await storage.get<string>(ALERTS_STORAGE_KEY);
    
    // If we have alerts stored, return them
    if (stored) {
      const alerts: PersistedAlert[] = JSON.parse(stored);

      // Clean up stale alerts
      const now = Date.now();
      const valid = alerts.filter(a => now - a.savedAt < MAX_ALERT_AGE);

      if (valid.length !== alerts.length) {
        // Store cleaned version
        await storage.set(ALERTS_STORAGE_KEY, JSON.stringify(valid));
      }

      console.log(`📦 Loaded ${valid.length} alerts from phone storage`);
      return valid;
    }

    // If storage is empty, try to fetch from API
    // This handles first-time users or after logout/app reinstall
    try {
      console.log('📡 Storage empty, fetching alert history from API...');
      const { fetchAlerts } = await import('./api');
      const apiAlerts = await fetchAlerts(500); // Get up to 500 alerts
      
      if (apiAlerts && apiAlerts.length > 0) {
        // Convert API alerts to persistent format and save
        const persistedAlerts: PersistedAlert[] = apiAlerts.map(a => ({
          id: a.id || `alert-${Date.now()}`,
          device_id: a.device_id || '',
          device_name: a.device_name,
          message: a.message || (a as any).subject || '',
          severity: (a.severity || 'warning') as any,
          status: (a.status || 'open') as any,
          created_at: a.created_at || new Date().toISOString(),
          acknowledged_at: a.acknowledged_at,
          resolved_at: a.resolved_at,
          escalation_level: a.escalation_level,
          savedAt: Date.now(),
          read: false, // Mark as unread since user is seeing them for first time
        }));

        // Keep only last 30 days and max 500
        const now = Date.now();
        const filtered = persistedAlerts
          .filter(a => now - a.savedAt < MAX_ALERT_AGE)
          .slice(0, MAX_ALERTS_STORED);

        // Save to storage
        await storage.set(ALERTS_STORAGE_KEY, JSON.stringify(filtered));
        console.log(`✅ Synced ${filtered.length} alerts from API to phone storage`);
        return filtered;
      }
    } catch (apiError) {
      console.warn('⚠️ Failed to fetch alerts from API:', apiError);
      // Fall through to return empty array
    }

    return [];
  } catch (error) {
    console.error('❌ Failed to load alerts:', error);
    return [];
  }
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  try {
    const alerts = await loadAlerts();
    const alert = alerts.find(a => a.id === alertId);

    if (alert) {
      alert.read = true;
      await storage.set(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
      console.log(`✅ Alert ${alertId} marked as read`);
    }
  } catch (error) {
    console.error('❌ Failed to mark alert as read:', error);
  }
}

/**
 * Get unread alert count
 */
export async function getUnreadAlertCount(): Promise<number> {
  try {
    const alerts = await loadAlerts();
    return alerts.filter(a => !a.read).length;
  } catch (error) {
    console.error('❌ Failed to get unread count:', error);
    return 0;
  }
}

/**
 * Get recent alerts (e.g., last 7 days)
 */
export async function getRecentAlerts(days: number = 7): Promise<PersistedAlert[]> {
  try {
    const alerts = await loadAlerts();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return alerts.filter(a => a.savedAt > cutoff);
  } catch (error) {
    console.error('❌ Failed to get recent alerts:', error);
    return [];
  }
}

/**
 * Get alerts by device
 */
export async function getAlertsByDevice(deviceId: string): Promise<PersistedAlert[]> {
  try {
    const alerts = await loadAlerts();
    return alerts.filter(a => a.device_id === deviceId);
  } catch (error) {
    console.error('❌ Failed to get alerts by device:', error);
    return [];
  }
}

/**
 * Delete alert
 */
export async function deleteAlert(alertId: string): Promise<void> {
  try {
    const alerts = await loadAlerts();
    const filtered = alerts.filter(a => a.id !== alertId);
    await storage.set(ALERTS_STORAGE_KEY, JSON.stringify(filtered));
    console.log(`🗑️ Alert ${alertId} deleted`);
  } catch (error) {
    console.error('❌ Failed to delete alert:', error);
  }
}

/**
 * Clear all alerts (logout scenario)
 */
export async function clearAllAlerts(): Promise<void> {
  try {
    await storage.remove(ALERTS_STORAGE_KEY);
    console.log('🗑️ All alerts cleared');
  } catch (error) {
    console.error('❌ Failed to clear alerts:', error);
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStats(): Promise<{
  total: number;
  unread: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
}> {
  try {
    const alerts = await loadAlerts();

    const stats = {
      total: alerts.length,
      unread: alerts.filter(a => !a.read).length,
      byStatus: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    alerts.forEach(a => {
      stats.byStatus[a.status] = (stats.byStatus[a.status] || 0) + 1;
      stats.bySeverity[a.severity] = (stats.bySeverity[a.severity] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('❌ Failed to get alert stats:', error);
    return { total: 0, unread: 0, byStatus: {}, bySeverity: {} };
  }
}
