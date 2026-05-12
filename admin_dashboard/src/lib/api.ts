const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
}

export async function fetchDevices() {
  const response = await fetch(`${API_BASE_URL}/api/devices`)
  if (!response.ok) throw new Error('Failed to fetch devices')
  const result: ApiResponse<any[]> = await response.json()
  return result.data || []
}

export async function getDeviceById(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/devices/${id}`)
  if (!response.ok) throw new Error('Failed to fetch device')
  const result: ApiResponse<any> = await response.json()
  return result.data
}

export async function searchDevices(query: string) {
  const response = await fetch(`${API_BASE_URL}/api/devices/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('Failed to search devices')
  const result: ApiResponse<any[]> = await response.json()
  return result.data || []
}

export async function getDeviceStats() {
  const response = await fetch(`${API_BASE_URL}/api/devices/stats/all`)
  if (!response.ok) throw new Error('Failed to fetch stats')
  const result: ApiResponse<any> = await response.json()
  return result.data
}

export async function triggerSync() {
  const response = await fetch(`${API_BASE_URL}/api/sync`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to trigger sync')
  return await response.json()
}

export async function getSyncStatus() {
  const response = await fetch(`${API_BASE_URL}/api/sync/status`)
  if (!response.ok) throw new Error('Failed to fetch sync status')
  return await response.json()
}

export async function getSyncLogs(limit: number = 20) {
  const response = await fetch(`${API_BASE_URL}/api/sync/logs?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to fetch sync logs')
  const result: ApiResponse<any[]> = await response.json()
  return result.data || []
}
