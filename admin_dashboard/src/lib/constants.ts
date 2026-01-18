// System-wide constants for TDS monitoring and ThingSpeak integration

export const TDS_RANGES = {
    // User-visible safe range
    SAFE_MIN: 50,
    SAFE_MAX: 150,

    // Internal buffers (not shown to users)
    BUFFER_LOWER: 15,  // Actual threshold: 35 ppm (50 - 15)
    BUFFER_UPPER: 15,  // Actual threshold: 165 ppm (150 + 15)

    // Minimum valid reading (filter out sensor noise)
    MIN_VALID: 20
} as const

// Calculate internal thresholds
export const TDS_THRESHOLDS = {
    CRITICAL_LOW: TDS_RANGES.SAFE_MIN - TDS_RANGES.BUFFER_LOWER,   // 35 ppm
    WARNING_LOW: TDS_RANGES.SAFE_MIN,                               // 50 ppm
    WARNING_HIGH: TDS_RANGES.SAFE_MAX,                              // 150 ppm
    CRITICAL_HIGH: TDS_RANGES.SAFE_MAX + TDS_RANGES.BUFFER_UPPER   // 165 ppm
} as const

// Offline detection threshold (1 hour)
export const OFFLINE_THRESHOLD_MS = 60 * 60 * 1000

// ThingSpeak polling interval (5 seconds for very fast updates)
export const THINGSPEAK_POLL_INTERVAL = 5000

// ThingSpeak API configuration
export const THINGSPEAK_CONFIG = {
    BASE_URL: 'https://api.thingspeak.com',
    RESULTS_LIMIT: 100, // Number of historical readings to fetch
    TIMEOUT: 10000      // API request timeout (10 seconds)
} as const

/**
 * Determine device status based on TDS value
 * Uses internal buffers for more accurate status determination
 */
export function getTDSStatus(tds: number | null | undefined): 'online' | 'warning' | 'critical' | 'offline' {
    if (tds === null || tds === undefined) return 'offline'
    if (tds <= TDS_RANGES.MIN_VALID) return 'offline' // Invalid reading

    if (tds < TDS_THRESHOLDS.CRITICAL_LOW || tds > TDS_THRESHOLDS.CRITICAL_HIGH) {
        return 'critical'
    }
    if (tds < TDS_THRESHOLDS.WARNING_LOW || tds > TDS_THRESHOLDS.WARNING_HIGH) {
        return 'warning'
    }
    return 'online'
}

/**
 * Check if a device is offline based on last reading timestamp
 */
export function isDeviceOffline(lastReadingTime: string | null | undefined): boolean {
    if (!lastReadingTime) return true
    const lastReading = new Date(lastReadingTime).getTime()
    const now = Date.now()
    return (now - lastReading) > OFFLINE_THRESHOLD_MS
}

/**
 * Filter valid TDS readings (exclude <= 20 ppm)
 */
export function isValidTDSReading(tds: number | null | undefined): boolean {
    return tds !== null && tds !== undefined && tds > TDS_RANGES.MIN_VALID
}
