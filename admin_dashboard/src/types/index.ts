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

    status: 'online' | 'offline' | 'critical' | 'maintenance'
    last_seen_at?: string
    deployment_date?: string
    metadata?: Record<string, unknown>
    confidence_score?: number
    last_reading_at?: string

    // Lifecycle/Rotation
    qr_rotation_pending?: boolean
    updated_at?: string

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
    details: unknown;
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
        [key: string]: unknown // Flexible for future sensors
    }
    recorded_at: string
}

export type Alert = {
    id: string
    device_id: string
    type: string
    severity: 'info' | 'critical'
    message: string
    value_at_time: number
    threshold_snapshot?: Record<string, unknown>
    status: 'open' | 'acknowledged' | 'resolved'
    created_at: string
    acknowledged_at?: string
    resolved_at?: string
    resolved_by?: string
    escalation_level?: number
    device_name?: string // Added for convenience in UI
    expiresAt?: any
    last_notified_at?: string
    delivery_history?: Record<string, {
        status: string
        timestamp: string
        reason: string
        success: boolean
    }>
}

export interface DeviceEvent {
    id: string
    device_id: string
    previous_state: string
    new_state: 'online' | 'offline' | 'warning' | 'critical'
    reason: string
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
}

// Map & UI Types
export type MapStyle = 'street' | 'satellite'
export type FilterType = 'all' | 'online' | 'critical' | 'offline'

export interface MapTheme {
    bg: {
        primary: string
        secondary: string
        tertiary: string
        card: string
        glass: string
    }
    border: {
        subtle: string
        light: string
        accent: string
    }
    text: {
        primary: string
        secondary: string
        muted: string
        accent: string
    }
    status: {
        online: StatusStyle
        critical: StatusStyle
        offline: StatusStyle
    }
    chart: {
        tds: ChartStyle
        temp: ChartStyle
    }
}

export interface StatusStyle {
    color: string
    glow: string
    bg: string
}

export interface ChartStyle {
    stroke: string
    fill: string
    glow: string
}

export type DeviceLocation = EnrichedDevice

export interface NotificationAlert {
    severity?: 'info' | 'warning' | 'high' | 'critical' | 'success';
    message?: string;
    type?: string;
    created_at?: any; // Consider using firebase.firestore.Timestamp if possible
    tds_value?: number;
    device_name?: string;
}

export interface EChartsParams {
    name: string;
    value: number | string;
    percent: number;
    color: string;
    data: any;
}

export interface SystemHealthLog {
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    source: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface UptimeStat {
    id: string;
    device_id: string;
    device_name?: string;
    timestamp: string;
    uptime_percentage: number;
    downtime_minutes: number;
    period: '24h' | '7d' | '30d';
}

