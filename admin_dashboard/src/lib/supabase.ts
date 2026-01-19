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
    name: string
    location_name?: string
    description?: string
    latitude: number
    longitude: number

    // ThingSpeak integration
    thingspeak_channel_id?: string
    thingspeak_read_key?: string
    thingspeak_write_key?: string

    // Hardware Identity
    node_number?: string
    sim_number?: string
    serial_number?: string

    // Field Mapping (which ThingSpeak field contains which data)
    tds_field_number?: number
    temperature_field_number?: number
    voltage_field_number?: number

    status: 'online' | 'offline' | 'warning' | 'critical' | 'maintenance'
    last_seen_at?: string
    deployment_date?: string
    metadata?: Record<string, any>
    confidence_score?: number
    last_reading_at?: string

    created_at: string
}

/**
 * Enriched Device type with runtime sensor data from ThingSpeak
 * Properties added by useAllDevicesThingSpeakData hook
 */
export type EnrichedDevice = Device & {
    latest_tds?: number
    latest_temp?: number
    latest_voltage?: number
    is_offline?: boolean
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
    id: string
    device_id: string
    type: string
    severity: 'info' | 'warning' | 'critical'
    message: string
    value_at_time: number
    threshold_snapshot?: Record<string, any>
    status: 'open' | 'acknowledged' | 'resolved'
    created_at: string
    acknowledged_at?: string
    resolved_at?: string
    resolved_by?: string
    escalation_level?: number
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
