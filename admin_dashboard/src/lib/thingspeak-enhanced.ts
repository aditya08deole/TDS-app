/**
 * Enhanced ThingSpeak API Utility
 * 
 * Supports URL-based chart embedding and flexible data fetching
 * Based on ThingSpeak chart URL pattern:
 * https://thingspeak.mathworks.com/channels/{CHANNEL_ID}/charts/{FIELD}?
 *   bgcolor={COLOR}&color={COLOR}&dynamic=true&type=line&update={SECONDS}&
 *   width=auto&height=auto&results={COUNT}&api_key={READ_KEY}
 * 
 * Best Practices:
 * - Use results <= 100 for real-time to avoid 5-minute caching
 * - Respect rate limits (15-20 seconds between requests)
 * - Maximum 8000 results per request
 * - Free accounts: 8000 API requests per day
 */

export interface ThingSpeakChartConfig {
    channelId: string | number
    field: number // 1-8
    readApiKey: string
    results?: number // Default 100 for real-time
    bgcolor?: string // Hex color without #
    color?: string // Hex color without #
    dynamic?: boolean // Auto-update
    type?: 'line' | 'spline' | 'area' | 'bar' | 'column'
    update?: number // Update interval in seconds
    width?: string | number
    height?: string | number
}

export interface ThingSpeakFetchConfig {
    channelId: string | number
    readApiKey?: string
    results?: number // 1-8000, use <=100 for real-time
    start?: string // YYYY-MM-DD HH:NN:SS
    end?: string // YYYY-MM-DD HH:NN:SS
    days?: number
    minutes?: number
    hours?: number
    aggregation?: 'average' | 'sum' | 'median' | 'min' | 'max'
    aggregationInterval?: 10 | 15 | 20 | 30 | 60 | 240 | 720 | 1440
    timezone?: string // e.g., 'America/New_York'
    offset?: number // Timezone offset in hours
    status?: boolean // Include status updates
    location?: boolean // Include location data
    metadata?: boolean // Include metadata
}

export interface ThingSpeakEntry {
    created_at: string
    entry_id: number
    field1?: string | null
    field2?: string | null
    field3?: string | null
    field4?: string | null
    field5?: string | null
    field6?: string | null
    field7?: string | null
    field8?: string | null
}

export interface ThingSpeakResponse {
    channel: {
        id: number
        name: string
        description?: string
        latitude?: string
        longitude?: string
        field1?: string
        field2?: string
        field3?: string
        field4?: string
        field5?: string
        field6?: string
        field7?: string
        field8?: string
        created_at: string
        updated_at: string
        last_entry_id: number
    }
    feeds: ThingSpeakEntry[]
}

/**
 * Generate ThingSpeak chart embed URL
 * 
 * @example
 * const url = generateChartUrl({
 *   channelId: 3212670,
 *   field: 2,
 *   readApiKey: 'UXORK5OUGJ2VK5PX',
 *   results: 50,
 *   bgcolor: 'FFFFFF',
 *   color: '000000',
 *   dynamic: true,
 *   type: 'line',
 *   update: 15
 * })
 */
export function generateChartUrl(config: ThingSpeakChartConfig): string {
    const {
        channelId,
        field,
        readApiKey,
        results = 100,
        bgcolor = 'FFFFFF',
        color = '000000',
        dynamic = true,
        type = 'line',
        update = 15,
        width = 'auto',
        height = 'auto'
    } = config

    const params = new URLSearchParams({
        bgcolor,
        color,
        dynamic: dynamic.toString(),
        type,
        update: update.toString(),
        width: width.toString(),
        height: height.toString(),
        results: results.toString(),
        api_key: readApiKey
    })

    return `https://thingspeak.mathworks.com/channels/${channelId}/charts/${field}?${params.toString()}`
}

/**
 * Fetch data from ThingSpeak with flexible configuration
 * 
 * @example
 * // Get latest 50 entries (real-time, no caching)
 * const data = await fetchThingSpeakData({
 *   channelId: 3212670,
 *   readApiKey: 'YOUR_KEY',
 *   results: 50
 * })
 * 
 * @example
 * // Get last 24 hours with hourly averages
 * const data = await fetchThingSpeakData({
 *   channelId: 3212670,
 *   hours: 24,
 *   aggregation: 'average',
 *   aggregationInterval: 60
 * })
 */
export async function fetchThingSpeakData(
    config: ThingSpeakFetchConfig
): Promise<ThingSpeakResponse> {
    const {
        channelId,
        readApiKey,
        results = 100, // Default to 100 for real-time (avoids caching)
        start,
        end,
        days,
        minutes,
        hours,
        aggregation,
        aggregationInterval,
        timezone,
        offset,
        status = false,
        location = false,
        metadata = false
    } = config

    // Build query parameters
    const params = new URLSearchParams()

    // Add API key if provided
    if (readApiKey) {
        params.append('api_key', readApiKey)
    }

    // Add results parameter (highest precedence)
    if (results) {
        params.append('results', Math.min(results, 8000).toString())
    }

    // Add time range parameters
    if (start) {
        params.append('start', start)
    }
    if (end) {
        params.append('end', end)
    }
    if (days) {
        params.append('days', days.toString())
    }
    if (minutes) {
        params.append('minutes', minutes.toString())
    }
    if (hours) {
        params.append('hours', hours.toString())
    }

    // Add aggregation parameters
    if (aggregation && aggregationInterval) {
        params.append(aggregation, aggregationInterval.toString())
    }

    // Add timezone parameters
    if (timezone) {
        params.append('timezone', timezone)
    }
    if (offset !== undefined) {
        params.append('offset', offset.toString())
    }

    // Add optional flags
    if (status) {
        params.append('status', 'true')
    }
    if (location) {
        params.append('location', 'true')
    }
    if (metadata) {
        params.append('metadata', 'true')
    }

    // Build URL
    const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?${params.toString()}`

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            headers: {
                'Accept': 'application/json'
            }
        })

        if (!response.ok) {
            throw new Error(`ThingSpeak API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                throw new Error('ThingSpeak API request timed out after 15 seconds')
            }
            throw error
        }
        throw new Error('Unknown error fetching ThingSpeak data')
    }
}

/**
 * Fetch latest entry (most efficient for real-time)
 */
export async function fetchThingSpeakLatest(
    channelId: string | number,
    readApiKey?: string
): Promise<ThingSpeakEntry> {
    const params = new URLSearchParams()
    if (readApiKey) {
        params.append('api_key', readApiKey)
    }

    const url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json?${params.toString()}`

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
            headers: {
                'Accept': 'application/json'
            }
        })

        if (!response.ok) {
            throw new Error(`ThingSpeak API error: ${response.status} ${response.statusText}`)
        }

        return await response.json()
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                throw new Error('ThingSpeak API request timed out')
            }
            throw error
        }
        throw new Error('Unknown error fetching latest ThingSpeak data')
    }
}

/**
 * Fetch specific field data
 */
export async function fetchThingSpeakField(
    channelId: string | number,
    config: Omit<ThingSpeakFetchConfig, 'channelId'> = {}
): Promise<ThingSpeakEntry[]> {
    const response = await fetchThingSpeakData({
        channelId,
        ...config
    })

    return response.feeds
}

/**
 * Parse field value safely
 */
export function parseFieldValue(value: string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
        return null
    }
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
}

/**
 * Best practices constants
 */
export const THINGSPEAK_LIMITS = {
    /** Use results <= 100 to avoid 5-minute caching */
    REAL_TIME_MAX_RESULTS: 100,

    /** Maximum results per request */
    MAX_RESULTS: 8000,

    /** Recommended minimum interval between requests (ms) */
    MIN_REQUEST_INTERVAL: 15000,

    /** Daily API request limit for free accounts */
    FREE_ACCOUNT_DAILY_LIMIT: 8000,

    /** Valid aggregation intervals (minutes) */
    VALID_AGGREGATION_INTERVALS: [10, 15, 20, 30, 60, 240, 720, 1440] as const,

    /** Default update interval for charts (seconds) */
    DEFAULT_CHART_UPDATE: 15,

    /** Maximum fields per channel */
    MAX_FIELDS: 8
} as const
