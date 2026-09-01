// System-wide constants for TDS monitoring and ThingSpeak integration

export const TDS_RANGES = {
    // User-visible safe range (Default)
    SAFE_MIN: 35,
    SAFE_MAX: 175,

    // Minimum valid reading (filter out sensor noise)
    MIN_VALID: 20,
    
    // Maximum valid reading (filter out voltage/temp misreads)
    // Increased to 2000 ppm to support a wider range of water sources
    MAX_VALID: 2000
} as const

// Calculate internal thresholds (Fallback)
export const TDS_THRESHOLDS = {
    CRITICAL_LOW: TDS_RANGES.SAFE_MIN,   // 35 ppm
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
 * Determine device TDS quality status based on TDS value.
 * NOTE: This function classifies DATA QUALITY only, not connectivity.
 * - 'online': valid reading within safe range
 * - 'critical': valid reading outside safe range
 * - For missing/invalid readings, returns 'online' to avoid false offline status.
 *   Use getConnectivityStatus() separately for actual connectivity.
 */
export function getTDSStatus(
    tds: number | null | undefined, 
    customMin?: number, 
    customMax?: number
): 'online' | 'critical' | 'offline' {
    // No data at all — cannot determine quality; caller must use getConnectivityStatus for offline state
    if (tds === null || tds === undefined) return 'online'
    // Reading below minimum valid threshold is sensor noise — treat as missing, not offline
    if (tds <= TDS_RANGES.MIN_VALID) return 'online'

    const min = customMin ?? TDS_THRESHOLDS.CRITICAL_LOW
    const max = customMax ?? TDS_THRESHOLDS.CRITICAL_HIGH

    if (tds < min || tds > max) {
        return 'critical'
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
 * Filter valid TDS readings (exclude <= 20 ppm and >= 500 ppm)
 * Upper bound prevents false alerts from voltage/temp misreads (e.g., 663)
 */
export function isValidTDSReading(tds: number | null | undefined): boolean {
    return tds !== null && 
           tds !== undefined && 
           tds > TDS_RANGES.MIN_VALID && 
           tds < TDS_RANGES.MAX_VALID
}

/**
 * Categorize device based on TDS value (independent of connectivity)
 * A device can be offline but still have a TDS category based on last reading
 * Returns 'unknown' for values outside valid range (prevents false alerts)
 */
export function getTDSCategory(
    tds: number | null | undefined,
    customMin?: number,
    customMax?: number
): 'safe' | 'critical' | 'unknown' {
    if (tds === null || tds === undefined) return 'unknown'
    if (tds <= TDS_RANGES.MIN_VALID || tds >= TDS_RANGES.MAX_VALID) return 'unknown' // Invalid reading

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
    } catch {
        return 'offline'
    }
}

/**
 * Type definitions for dual categorization
 */
export type TDSCategory = 'safe' | 'critical' | 'unknown'
export type ConnectivityStatus = 'online' | 'offline'

/**
 * Format and sanitize device or location name, ensuring legacy database names
 * with "Smart Valve" or "Valve" are presented cleanly as EvaraTDS.
 */
export function formatDeviceName(name?: string | null): string {
    if (!name) return 'EvaraTDS Device'
    return name
        .replace(/Smart\s*Valve/gi, 'EvaraTDS')
        .replace(/SmartValve/gi, 'EvaraTDS')
        .replace(/\bValve\b/gi, 'Device')
}

/**
 * Helper function to get device display name
 * Prefers location_name over device name, sanitized for consistent branding
 */
export function getDeviceDisplayName(device: { location_name?: string | null; name: string }): string {
    const raw = device.location_name || device.name || 'EvaraTDS Device'
    return formatDeviceName(raw)
}

