// System-wide constants for TDS monitoring and ThingSpeak integration

export const TDS_RANGES = {
    // User-visible safe range (Default)
    SAFE_MIN: 35,
    SAFE_MAX: 175,

    // Minimum valid reading (filter out sensor noise)
    MIN_VALID: 20
} as const

// Calculate internal thresholds (Fallback)
export const TDS_THRESHOLDS = {
    CRITICAL_LOW: TDS_RANGES.SAFE_MIN,   // 35 ppm
    WARNING_LOW: TDS_RANGES.SAFE_MIN + 15, // 50 ppm
    WARNING_HIGH: TDS_RANGES.SAFE_MAX - 25, // 150 ppm
    CRITICAL_HIGH: TDS_RANGES.SAFE_MAX   // 175 ppm
} as const

/**
 * Industrial IoT Heartbeat Detection Configuration
 * Based on best practices for real-time device monitoring
 */
export const HEARTBEAT_CONFIG = {
    // Expected heartbeat interval (devices send data every 15-30 seconds)
    EXPECTED_INTERVAL_MS: 30 * 1000,        // 30 seconds

    // Offline threshold: 1 hour (as per user request for industrial monitoring)
    OFFLINE_THRESHOLD_MS: 60 * 60 * 1000,    // 1 hour

    // Grace period before marking device as offline
    GRACE_PERIOD_MS: 30 * 1000,             // 30 seconds

    // Maximum time before device is considered stale
    STALE_THRESHOLD_MS: 5 * 60 * 1000       // 5 minutes
} as const

// Legacy constant for backward compatibility (now using HEARTBEAT_CONFIG)
export const OFFLINE_THRESHOLD_MS = HEARTBEAT_CONFIG.OFFLINE_THRESHOLD_MS

// 3 seconds for real-time monitoring (Phase 1: UI/UX Enhancement - faster updates)
export const THINGSPEAK_POLL_INTERVAL = 3000

/**
 * ThingSpeak API Configuration
 */
export const THINGSPEAK_CONFIG = {
    BASE_URL: 'https://api.thingspeak.com',
    RESULTS_LIMIT: 100, // Number of historical readings to fetch
    TIMEOUT: 10000      // API request timeout (10 seconds)
} as const

/**
 * Determine device status based on TDS value
 * Uses internal buffers for more accurate status determination
 */
export function getTDSStatus(
    tds: number | null | undefined, 
    customMin?: number, 
    customMax?: number
): 'online' | 'warning' | 'critical' | 'offline' {
    if (tds === null || tds === undefined) return 'offline'
    if (tds <= TDS_RANGES.MIN_VALID) return 'offline' // Invalid reading

    const min = customMin ?? TDS_THRESHOLDS.CRITICAL_LOW
    const max = customMax ?? TDS_THRESHOLDS.CRITICAL_HIGH

    if (tds < min || tds > max) {
        return 'critical'
    }
    
    // Warning thresholds are relative to the safe range
    const warningLow = min + 15 
    const warningHigh = max - 25

    if (tds < warningLow || tds > warningHigh) {
        return 'warning'
    }
    return 'online'
}

/**
 * Check if a device is offline based on last reading timestamp
 * @deprecated Use getConnectivityStatus instead for dual categorization
 */
export function isDeviceOffline(lastReadingTime: string | null | undefined): boolean {
    if (!lastReadingTime) return true
    const lastReading = new Date(lastReadingTime).getTime()
    const now = Date.now()
    return (now - lastReading) > HEARTBEAT_CONFIG.OFFLINE_THRESHOLD_MS
}

/**
 * Filter valid TDS readings (exclude <= 20 ppm)
 */
export function isValidTDSReading(tds: number | null | undefined): boolean {
    return tds !== null && tds !== undefined && tds > TDS_RANGES.MIN_VALID
}

/**
 * Categorize device based on TDS value (independent of connectivity)
 * A device can be offline but still have a TDS category based on last reading
 */
export function getTDSCategory(
    tds: number | null | undefined,
    customMin?: number,
    customMax?: number
): 'safe' | 'critical' | 'unknown' {
    if (tds === null || tds === undefined) return 'unknown'
    if (tds <= TDS_RANGES.MIN_VALID) return 'unknown' // Invalid reading

    const min = customMin ?? TDS_THRESHOLDS.CRITICAL_LOW
    const max = customMax ?? TDS_THRESHOLDS.CRITICAL_HIGH

    // Critical if outside safe range
    if (tds < min || tds > max) {
        return 'critical'
    }

    // Safe if within range
    return 'safe'
}

/**
 * Industrial IoT Heartbeat Detection Algorithm
 * 
 * Determines connectivity status based on last reading timestamp.
 * 
 * Rules:
 * 1. Device is ONLINE if last_seen_at < 1 hour ago
 * 2. Device is OFFLINE if last_seen_at >= 1 hour ago
 * 
 * @param lastReadingTime - ISO timestamp of last reading
 * @returns 'online' | 'offline'
 */
export function getConnectivityStatus(lastReadingTime: string | null | undefined): 'online' | 'offline' {
    if (!lastReadingTime) return 'offline'

    try {
        // Ensure ISO format (replace space with T if needed)
        const normalized = lastReadingTime.includes(' ') && !lastReadingTime.includes('T') 
            ? lastReadingTime.replace(' ', 'T') 
            : lastReadingTime
            
        const lastReading = new Date(normalized).getTime()
        const now = Date.now()
        const msSinceLastReading = now - lastReading

        // Online if data received within the last 1 hour
        return msSinceLastReading < HEARTBEAT_CONFIG.OFFLINE_THRESHOLD_MS ? 'online' : 'offline'
    } catch (error) {
        return 'offline'
    }
}

/**
 * Type definitions for dual categorization
 */
export type TDSCategory = 'safe' | 'critical' | 'unknown'
export type ConnectivityStatus = 'online' | 'offline'

/**
 * Helper function to get device display name
 * Prefers location_name over device name
 */
export function getDeviceDisplayName(device: { location_name?: string | null; name: string }): string {
    return device.location_name || device.name || 'Unknown Device'
}

