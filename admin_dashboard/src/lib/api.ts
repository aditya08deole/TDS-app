import { type Device, type SystemHealthLog, type UptimeStat } from '../types'
import { getApiBaseUrl } from './remoteConfig'
import { isOnline, getCachedDevices, cacheDevices } from './offlineStorage'
import { dedupFetch, invalidateCache } from './caching'
import { apiFetch } from './apiClient'

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
  expiresAt?: string
}



export interface InviteToken {
  id: string
  token_preview: string
  role: 'field_engineer' | 'viewer' | 'admin'
  created_by: string
  created_at: string
  expires_at: string
  status: 'pending' | 'used' | 'expired'
  used_by?: string
  used_at?: string
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
  // Uses apiFetch which injects the Firebase Bearer token — the backend now
  // requires admin+ (requireRole('admin')) for device creation.
  const response = await apiFetch('/api/devices', {
    method: 'POST',
    body: JSON.stringify(deviceData)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || error.error || 'Failed to create device')
  }
  const result: ApiResponse<Device> = await response.json()

  // Invalidate device cache after mutation
  invalidateCache('/api/devices');

  return result.data
}

export async function deleteDevice(id: string) {
  // Backend now requires admin+ (requireRole('admin')) for device deletion.
  const response = await apiFetch(`/api/devices/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || error.error || 'Failed to delete device')
  }

  // Invalidate device caches after mutation
  invalidateCache('/api/devices');
  invalidateCache(`/api/devices/${id}`);

  return await response.json()
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
  // Backend now requires field_engineer+ (requireRole('field_engineer')) for device edits.
  const response = await apiFetch(`/api/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || error.error || 'Failed to update device')
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
  const endpoint = `/api/alerts?limit=${limit}`;
  return dedupFetch(endpoint, async () => {
    const response = await apiFetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch alerts')
    const result: ApiResponse<AlertRecord[]> = await response.json()
    return Array.isArray(result.data) ? result.data : []
  }, { useSwrPattern: true });
}

/**
 * Builds a diagnosable error from a failed fetch Response — includes the
 * HTTP status so failures like "502 Bad Gateway" (backend unreachable) are
 * immediately distinguishable from "403 Forbidden" (role denied) instead of
 * collapsing into one generic message.
 */
async function apiErrorFromResponse(response: Response, fallback: string): Promise<Error> {
  const bodyText = await response.text().catch(() => '')
  let message = fallback
  try {
    const parsed = bodyText ? JSON.parse(bodyText) : null
    if (parsed?.error) message = parsed.error
  } catch {
    // Non-JSON body (e.g. a platform-level error page) — fall through to fallback
  }
  return new Error(`${message} (HTTP ${response.status})`)
}

export async function acknowledgeAlertApi(alertId: string, _userId: string, _role: string): Promise<void> {
  // Uses apiFetch which injects Firebase Bearer token — role enforced server-side
  const response = await apiFetch(`/api/alerts/${alertId}/ack`, {
    method: 'PUT',
    body: JSON.stringify({}),
  })
  if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to acknowledge alert')
  invalidateCache('/api/alerts');
}

export async function resolveAlertApi(alertId: string, _userId: string, _role: string, note?: string): Promise<void> {
  // Uses apiFetch which injects Firebase Bearer token — role enforced server-side
  const response = await apiFetch(`/api/alerts/${alertId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
  })
  if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to resolve alert')
  invalidateCache('/api/alerts');
}



// ─── Invite Token API ─────────────────────────────────────────────────────────

/** Generate an invite link for a specific role (admin/super_admin only) */
export async function generateInviteApi(role: 'field_engineer' | 'viewer' | 'admin'): Promise<{
  token: string;
  invite_link: string;
  role: string;
  expires_at: string;
}> {
  const response = await apiFetch('/api/users/invite', {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to generate invite')
  }
  return response.json()
}

/** List all invite tokens (admin/super_admin only) */
export async function listInvitesApi(): Promise<InviteToken[]> {
  const endpoint = `/api/users/invites`;
  // SWR: show cached data instantly on revisit, silently refresh in the
  // background, instead of blocking on a network round-trip every time.
  return dedupFetch(endpoint, async () => {
    const response = await apiFetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch invites')
    const result: ApiResponse<InviteToken[]> = await response.json()
    return Array.isArray(result.data) ? result.data : []
  }, { useSwrPattern: true });
}

/** Redeem an invite token after Firebase signup */
export async function redeemInviteApi(token: string, uid: string): Promise<{ success: boolean; role: string }> {
  // This is a public endpoint — no auth header needed (user just registered)
  const response = await fetch(`${getApiBaseUrl()}/api/users/redeem-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, uid }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to redeem invite')
  }
  return response.json()
}

/** Set default viewer role for new users who signed up without an invite */
export async function setDefaultRoleApi(uid: string): Promise<{ success: boolean; role: string }> {
  const response = await fetch(`${getApiBaseUrl()}/api/users/set-default-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to set default role')
  }
  return response.json()
}

/** Revoke a pending invite token (admin only) */
export async function revokeInviteApi(token: string): Promise<void> {
  const response = await apiFetch(`/api/users/invites/${token}`, { method: 'DELETE' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to revoke invite')
  }
  invalidateCache('/api/users/invites');
}

export interface UserRoleStats {
  total: number
  viewer: number
  field_engineer: number
  admin: number
  super_admin: number
}

/** Real user counts per role (admin/super_admin only) */
export async function getUserStatsApi(): Promise<UserRoleStats> {
  const endpoint = `/api/users/stats`;
  return dedupFetch(endpoint, async () => {
    const response = await apiFetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch user stats')
    const result: ApiResponse<UserRoleStats> = await response.json()
    return result.data
  }, { useSwrPattern: true });
}

export type UserRole = 'viewer' | 'field_engineer' | 'admin' | 'super_admin'

export interface DirectoryUser {
  uid: string
  email: string | null
  name: string | null
  role: UserRole
  joined_at: string | null
  invited_by: string | null
}

/** Full user directory — every real registered account (super_admin only) */
export async function listUsersApi(): Promise<DirectoryUser[]> {
  const endpoint = `/api/users`;
  return dedupFetch(endpoint, async () => {
    const response = await apiFetch(endpoint)
    if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to list users')
    const result: ApiResponse<DirectoryUser[]> = await response.json()
    return Array.isArray(result.data) ? result.data : []
  }, { useSwrPattern: true });
}

/** Assign a role to an existing user by uid (super_admin only) */
export async function setUserRoleApi(uid: string, role: UserRole): Promise<void> {
  const response = await apiFetch(`/api/users/${uid}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
  if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to change user role')
  invalidateCache('/api/users');
}
