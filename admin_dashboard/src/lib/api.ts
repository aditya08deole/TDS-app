import { type Device } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
}

export async function fetchDevices(): Promise<Device[]> {
  const response = await fetch(`${API_BASE_URL}/api/devices`)
  if (!response.ok) throw new Error('Failed to fetch devices')
  const result: ApiResponse<Device[]> = await response.json()
  return result.data || []
}

export async function getDeviceById(id: string): Promise<Device> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${id}`)
  if (!response.ok) throw new Error('Failed to fetch device')
  const result: ApiResponse<Device> = await response.json()
  return result.data
}

export async function searchDevices(query: string): Promise<Device[]> {
  const response = await fetch(`${API_BASE_URL}/api/devices/search?q=${encodeURIComponent(query)}`)
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
  const response = await fetch(`${API_BASE_URL}/api/devices/stats/all`)
  if (!response.ok) throw new Error('Failed to fetch stats')
  const result: ApiResponse<DeviceStats> = await response.json()
  return result.data
}

export async function triggerSync(): Promise<{ job_id: string }> {
  const response = await fetch(`${API_BASE_URL}/api/sync`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to trigger sync')
  return await response.json()
}

export async function getSyncStatus(): Promise<{ status: string; last_sync?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/sync/status`)
  if (!response.ok) throw new Error('Failed to fetch sync status')
  return await response.json()
}

export async function getSyncLogs(limit: number = 20): Promise<SyncLog[]> {
  const response = await fetch(`${API_BASE_URL}/api/sync/logs?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch sync logs')
  const result: ApiResponse<SyncLog[]> = await response.json()
  return result.data || []
}

export async function createDevice(deviceData: Partial<Device>): Promise<Device> {
  const response = await fetch(`${API_BASE_URL}/api/devices`, {
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
  const response = await fetch(`${API_BASE_URL}/api/devices/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to delete device')
  }
  return await response.json()
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${id}`, {
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
