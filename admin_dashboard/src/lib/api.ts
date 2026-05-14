import { type Device, type SystemHealthLog, type UptimeStat } from '../types'
import { getApiBaseUrl } from './remoteConfig'

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
  const response = await fetch(`${getBase()}/api/devices`)
  if (!response.ok) throw new Error('Failed to fetch devices')
  const result: ApiResponse<Device[]> = await response.json()
  return result.data || []
}

export async function getDeviceById(id: string): Promise<Device> {
  const response = await fetch(`${getBase()}/api/devices/${id}`)
  if (!response.ok) throw new Error('Failed to fetch device')
  const result: ApiResponse<Device> = await response.json()
  return result.data
}

export async function searchDevices(query: string): Promise<Device[]> {
  const response = await fetch(`${getBase()}/api/devices/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('Failed to search devices')
  const result: ApiResponse<Device[]> = await response.json()
  return result.data || []
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
  const response = await fetch(`${getBase()}/api/devices/stats/all`)
  if (!response.ok) throw new Error('Failed to fetch stats')
  const result: ApiResponse<DeviceStats> = await response.json()
  return result.data
}

export async function triggerSync(): Promise<{ job_id: string }> {
  const response = await fetch(`${getBase()}/api/sync`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to trigger sync')
  return await response.json()
}

export async function getSyncStatus(): Promise<{ status: string; last_sync?: string }> {
  const response = await fetch(`${getBase()}/api/sync/status`)
  if (!response.ok) throw new Error('Failed to fetch sync status')
  return await response.json()
}

export async function getSyncLogs(limit: number = 20): Promise<SyncLog[]> {
  const response = await fetch(`${getBase()}/api/sync/logs?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch sync logs')
  const result: ApiResponse<SyncLog[]> = await response.json()
  return result.data || []
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
  return result.data
}

export async function getDeviceSensorData(id: string, limit: number = 100): Promise<any[]> {
  const response = await fetch(`${getBase()}/api/devices/${id}/sensor-data?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch sensor data')
  const result: ApiResponse<any[]> = await response.json()
  return result.data || []
}

export async function getDeviceHealthEvents(id: string, limit: number = 50): Promise<any[]> {
  const response = await fetch(`${getBase()}/api/devices/${id}/health-events?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch health events')
  const result: ApiResponse<any[]> = await response.json()
  return result.data || []
}

export async function getSystemHealthLogs(limit: number = 100): Promise<SystemHealthLog[]> {
  const response = await fetch(`${getBase()}/api/devices/system/health?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch system health logs')
  const result: ApiResponse<SystemHealthLog[]> = await response.json()
  return result.data || []
}

export async function getUptimeStats(deviceId?: string): Promise<UptimeStat[]> {
  const url = deviceId 
    ? `${getBase()}/api/devices/system/uptime?deviceId=${deviceId}`
    : `${getBase()}/api/devices/system/uptime`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch uptime stats')
  const result: ApiResponse<UptimeStat[]> = await response.json()
  return result.data || []
}

export async function fetchAlerts(limit: number = 50): Promise<AlertRecord[]> {
  const response = await fetch(`${getBase()}/api/alerts?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch alerts')
  const result: ApiResponse<AlertRecord[]> = await response.json()
  return result.data || []
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
}

export async function fetchDeliveryLogs(limit: number, role: string): Promise<DeliveryLogRecord[]> {
  const response = await fetch(`${getBase()}/api/alerts/delivery-logs/list?limit=${limit}`, {
    headers: {
      'x-user-role': role,
    },
  })
  if (!response.ok) throw new Error('Failed to fetch delivery logs')
  const result: ApiResponse<DeliveryLogRecord[]> = await response.json()
  return result.data || []
}

export async function fetchWhatsAppRecipients(role: string): Promise<WhatsAppRecipient[]> {
  const response = await fetch(`${getBase()}/api/notifications/recipients/whatsapp`, {
    headers: { 'x-user-role': role },
  })
  if (!response.ok) throw new Error('Failed to fetch WhatsApp recipients')
  const result: ApiResponse<WhatsAppRecipient[]> = await response.json()
  return result.data || []
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
}
