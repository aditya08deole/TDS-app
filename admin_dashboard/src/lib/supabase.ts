import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
    id: string
    organization_id: string | null
    name: string | null
    role: 'super_admin' | 'admin' | 'operator' | 'engineer' | 'viewer'
    created_at: string
}

export type Device = {
    id: string
    organization_id: string | null
    name: string
    latitude: number
    longitude: number
    api_key: string
    status: 'online' | 'offline' | 'warning' | 'critical'
    last_seen: string | null
    created_at: string
}

export type SensorData = {
    id: number
    device_id: string
    tds: number
    temperature: number
    voltage: number
    recorded_at: string
}

export type Alert = {
    id: number
    device_id: string
    message: string
    severity: 'info' | 'warning' | 'critical'
    status: 'open' | 'acknowledged' | 'resolved'
    created_at: string
    acknowledged_by: string | null
    acknowledged_at: string | null
    resolved_at: string | null
    resolved_by: string | null
    escalation_level: number
    devices?: {
        name: string
    }
}

export type DeviceHeartbeat = {
    device_id: string
    last_seen: string
    voltage: number
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE'
}

export type DeviceStateHistory = {
    id: number
    device_id: string
    old_state: string
    new_state: string
    changed_at: string
}

export type AuditLogEntry = {
    id: number
    user_id: string
    action: string
    table_name: string
    record_id: string
    old_data: any
    new_data: any
    created_at: string
}
