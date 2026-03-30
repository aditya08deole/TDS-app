export type UserRole = 'super_admin' | 'admin' | 'operator' | 'engineer' | 'viewer'

export type Profile = {
    id: string
    organization_id: string | null
    name: string | null
    role: UserRole
    email: string
    avatar_url?: string
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

    // Field Mapping
    tds_field_number?: number
    temperature_field_number?: number
    voltage_field_number?: number

    status: 'online' | 'offline' | 'warning' | 'critical' | 'maintenance'
    last_seen_at?: string
    deployment_date?: string
    metadata?: Record<string, any>
    confidence_score?: number
    last_reading_at?: string

    // TDS Thresholds (Custom per device)
    safe_tds_min?: number
    safe_tds_max?: number

    created_at: string
}

export interface AuditLogEntry {
    id: string;
    created_at: string;
    actor_id: string;
    action: string;
    details: any;
    entity_type: string;
    entity_id: string;
    target_resource?: string; // Legacy support
}

export type EnrichedDevice = Device & {
    latest_tds?: number
    latest_temperature?: number
    latest_voltage?: number
    is_offline?: boolean
    tds_category?: 'safe' | 'critical' | 'unknown'
    connectivity_status?: 'online' | 'offline'
}

export type SensorData = {
    id: string // Changed to string for Firestore ID
    device_id: string
    payload: {
        tds: number
        temperature: number
        voltage: number
        [key: string]: any // Flexible for future sensors
    }
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
    device_name?: string // Added for convenience in UI
}
