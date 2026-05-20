import { type Device, type SystemHealthLog, type UptimeStat } from '../types'
import { getApiBaseUrl } from './remoteConfig'
import { isOnline, getCachedDevices, cacheDevices } from './offlineStorage'
import { dedupFetch, invalidateCache } from './caching'

// Dynamic URL getter — reads from Firebase Remote Config at runtime.
// Falls back to env variable or localhost if Remote Config is unavailable.
const getBase = () => getApiBaseUrl()

interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
}

export interface AlertRecord {
  id: string
  device_id: string
  device_name?: string
  message: string
  severity: 'info' | 'critical' | 'warning' | 'high'
  status: 'open' | 'acknowledged' | 'resolved'
  created_at: string
  acknowledged_at?: string
  resolved_at?: string
  escalation_level?: number
  expiresAt?: string
}

export interface DeliveryLogRecord {
  id: string
  alert_id: string
  channel: 'push' | 'whatsapp' | 'ntfy' | 'ifttt'
  status: 'success' | 'partial' | 'failed' | 'skipped'
  reason?: string
  error?: string
  recipient?: string
  success_count?: number
  failure_count?: number
  created_at: string
}

export interface WhatsAppRecipient {
  id: string
  phone_e164: string
  active: boolean
  created_at?: string
  updated_at?: string
}

export async function fetchDevices(): Promise<Device[]> {
  const endpoint = `${getBase()}/api/devices`;
  
  return dedupFetch(
    endpoint,
    async () => {
      // Try network first if online
      if (isOnline()) {
        const response = await fetch(endpoint)
        if (!response.ok) throw new Error('Failed to fetch devices')
        const result: ApiResponse<Device[]> = await response.json()
        const devices = result.data || []
        
        // Cache for offline use
        await cacheDevices(devices)
        return devices
      } else {
        // Offline: use cached data
        console.warn('📡 Offline mode: Loading devices from cache')
        const cached = await getCachedDevices()
        if (cached) return cached
        throw new Error('No cached data available and offline')
      }
    },
    { useSwrPattern: true }
  ).catch(async (error) => {
    // Fallback: try cache
    console.warn('⚠️ Failed to fetch devices, trying cache:', error)
    const cached = await getCachedDevices()
    if (cached) {
      console.log('✅ Using cached devices')
      return cached
    }
    throw new Error('Failed to fetch devices')
  });
}

export async function getDeviceById(id: string): Promise<Device> {
  const endpoint = `${getBase()}/api/devices/${id}`;
  return dedupFetch(endpoint, async () => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Failed to fetch device')
      const result: ApiResponse<Device> = await response.json()
      return result.data
    } catch (error) {
      // Fallback to cache if offline or error
      const { getCachedDevices } = await import('./offlineStorage')
      const cached = await getCachedDevices()
      const found = cached?.find(d => d.id === id)
      if (found) {
        console.log(`📦 Device ${id} loaded from offline cache`)
        return found
      }
      throw error
    }
  });
}

export async function searchDevices(query: string): Promise<Device[]> {
  const endpoint = `${getBase()}/api/devices/search?q=${encodeURIComponent(query)}`;
  return dedupFetch(endpoint, async () => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Failed to search devices')
      const result: ApiResponse<Device[]> = await response.json()
      return result.data || []
    } catch (error) {
      // Fallback to cache and filter locally
      const { getCachedDevices } = await import('./offlineStorage')
      const cached = await getCachedDevices()
      if (cached) {
        const filtered = cached.filter(d =>
          d.name?.toLowerCase().includes(query.toLowerCase()) ||
          (d as any).location?.toLowerCase().includes(query.toLowerCase()) ||
          (d as any).device_id?.toLowerCase().includes(query.toLowerCase())
        )
        console.log(`📦 Searched ${filtered.length} devices from offline cache`)
        return filtered
      }
      throw error
    }
  });
}

export interface DeviceStats {
  total: number
  online: number
  offline: number
  critical: number
  average_tds: number
}

export interface SyncLog {
  id: string
  status: 'success' | 'failure'
  message: string
  created_at: string
  duration_ms?: number
}

export async function getDeviceStats(): Promise<DeviceStats> {
  const endpoint = `${getBase()}/api/devices/stats/all`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch stats')
    const result: ApiResponse<DeviceStats> = await response.json()
    return result.data
  }, { useSwrPattern: true });
}

export async function triggerSync(): Promise<{ job_id: string }> {
  // Sync is a mutation, not read - bypass caching
  const response = await fetch(`${getBase()}/api/sync`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to trigger sync')
  
  // Invalidate caches after sync
  invalidateCache('/api/devices');
  invalidateCache('/sensor-data');
  invalidateCache('/health');
  
  return await response.json()
}

export async function getSyncStatus(): Promise<{ status: string; last_sync?: string }> {
  const endpoint = `${getBase()}/api/sync/status`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch sync status')
    return await response.json()
  }, { useSwrPattern: true });
}

export async function getSyncLogs(limit: number = 20): Promise<SyncLog[]> {
  const endpoint = `${getBase()}/api/sync/logs?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch sync logs')
    const result: ApiResponse<SyncLog[]> = await response.json()
    return result.data || []
  });
}

export async function createDevice(deviceData: Partial<Device>): Promise<Device> {
  const response = await fetch(`${getBase()}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create device')
  }
  const result: ApiResponse<Device> = await response.json()
  
  // Invalidate device cache after mutation
  invalidateCache('/api/devices');
  
  return result.data
}

export async function deleteDevice(id: string) {
  const response = await fetch(`${getBase()}/api/devices/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to delete device')
  }
  
  // Invalidate device caches after mutation
  invalidateCache('/api/devices');
  invalidateCache(`/api/devices/${id}`);
  
  return await response.json()
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
  const response = await fetch(`${getBase()}/api/devices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to update device')
  }
  const result: ApiResponse<Device> = await response.json()
  
  // Invalidate device caches after mutation
  invalidateCache('/api/devices');
  invalidateCache(`/api/devices/${id}`);
  
  return result.data
}

export async function getDeviceSensorData(id: string, limit: number = 100): Promise<any[]> {
  const endpoint = `${getBase()}/api/devices/${id}/sensor-data?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Failed to fetch sensor data')
      const result: ApiResponse<any[]> = await response.json()
      const data = result.data || []
      // Cache sensor data for offline use
      const { cacheSensorData } = await import('./offlineStorage')
      await cacheSensorData(id, data)
      return data
    } catch (error) {
      // Fallback to cached sensor data
      const { getCachedSensorData } = await import('./offlineStorage')
      const cached = await getCachedSensorData(id)
      if (cached) {
        console.log(`📦 Sensor data for device ${id} loaded from offline cache`)
        return cached
      }
      throw error
    }
  }, { useSwrPattern: true });
}

export async function getDeviceHealthEvents(id: string, limit: number = 50): Promise<any[]> {
  const endpoint = `${getBase()}/api/devices/${id}/health-events?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Failed to fetch health events')
      const result: ApiResponse<any[]> = await response.json()
      return result.data || []
    } catch (error) {
      // Note: Health events don't cache as aggressively - return empty instead of stale data
      console.warn(`⚠️ Health events offline not available`)
      return []
    }
  }, { useSwrPattern: true });
}

export async function getSystemHealthLogs(limit: number = 100): Promise<SystemHealthLog[]> {
  const endpoint = `${getBase()}/api/devices/system/health?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch system health logs')
    const result: ApiResponse<SystemHealthLog[]> = await response.json()
    return result.data || []
  }, { useSwrPattern: true });
}

export async function getUptimeStats(deviceId?: string): Promise<UptimeStat[]> {
  const url = deviceId 
    ? `${getBase()}/api/devices/system/uptime?deviceId=${deviceId}`
    : `${getBase()}/api/devices/system/uptime`
  
  return dedupFetch(url, async () => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch uptime stats')
    const result: ApiResponse<UptimeStat[]> = await response.json()
    return result.data || []
  }, { useSwrPattern: true });
}

export async function fetchAlerts(limit: number = 50): Promise<AlertRecord[]> {
  const endpoint = `${getBase()}/api/alerts?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch alerts')
    const result: ApiResponse<AlertRecord[]> = await response.json()
    return Array.isArray(result.data) ? result.data : []
  }, { useSwrPattern: true });
}

export async function acknowledgeAlertApi(alertId: string, userId: string, role: string): Promise<void> {
  const response = await fetch(`${getBase()}/api/alerts/${alertId}/ack`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': role,
    },
    body: JSON.stringify({ userId }),
  })
  if (!response.ok) throw new Error('Failed to acknowledge alert')
  
  // Invalidate alert caches
  invalidateCache('/api/alerts');
}

export async function resolveAlertApi(alertId: string, userId: string, role: string): Promise<void> {
  const response = await fetch(`${getBase()}/api/alerts/${alertId}/resolve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': role,
    },
    body: JSON.stringify({ userId }),
  })
  if (!response.ok) throw new Error('Failed to resolve alert')
  
  // Invalidate alert caches
  invalidateCache('/api/alerts');
}

export async function fetchDeliveryLogs(limit: number, role: string): Promise<DeliveryLogRecord[]> {
  const endpoint = `${getBase()}/api/alerts/delivery-logs/list?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint, {
      headers: {
        'x-user-role': role,
      },
    })
    if (!response.ok) throw new Error('Failed to fetch delivery logs')
    const result: ApiResponse<DeliveryLogRecord[]> = await response.json()
    return Array.isArray(result.data) ? result.data : []
  }, { useSwrPattern: true });
}

export async function fetchWhatsAppRecipients(role: string): Promise<WhatsAppRecipient[]> {
  const endpoint = `${getBase()}/api/notifications/recipients/whatsapp`;
  return dedupFetch(endpoint, async () => {
    const response = await fetch(endpoint, {
      headers: { 'x-user-role': role },
    })
    if (!response.ok) throw new Error('Failed to fetch WhatsApp recipients')
    const result: ApiResponse<WhatsAppRecipient[]> = await response.json()
    return result.data || []
  }, { useSwrPattern: false }); // Don't SWR - user-initiated
}

export async function addWhatsAppRecipientApi(phone: string, userId: string, role: string): Promise<void> {
  const response = await fetch(`${getBase()}/api/notifications/recipients/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': role,
    },
    body: JSON.stringify({ phone, userId }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to add WhatsApp recipient')
  }
  
  // Invalidate recipients cache
  invalidateCache('/api/notifications/recipients/whatsapp');
}

export async function removeWhatsAppRecipientApi(phone: string, userId: string, role: string): Promise<void> {
  const response = await fetch(`${getBase()}/api/notifications/recipients/whatsapp`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': role,
    },
    body: JSON.stringify({ phone, userId }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to remove WhatsApp recipient')
  }
  
  // Invalidate recipients cache
  invalidateCache('/api/notifications/recipients/whatsapp');
}
