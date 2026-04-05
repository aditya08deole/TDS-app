/**
 * Integrated ThingSpeak API Utility
 * 
 * Supports URL-based chart embedding, flexible data fetching, and real-time monitoring.
 */

// --- Types ---

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

export interface ParsedSensorData {
    tds: number
    temperature: number
    voltage: number
    timestamp: string
    entry_id: number
}

export interface FieldMapping {
    tds: number      // 1-8
    temperature: number  // 1-8
    voltage: number  // 1-8
}

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

// --- Internal Helpers ---

const BASE_URL = 'https://api.thingspeak.com'

function getFieldValue(entry: ThingSpeakEntry, fieldNumber: number): string | undefined {
    return entry[`field${fieldNumber}` as keyof ThingSpeakEntry] as string | undefined
}

function parseEntry(entry: ThingSpeakEntry, mapping: FieldMapping): ParsedSensorData {
    const rawTds = parseFloat(getFieldValue(entry, mapping.tds) || '0')
    const temperature = parseFloat(getFieldValue(entry, mapping.temperature) || '0')
    const voltage = parseFloat(getFieldValue(entry, mapping.voltage) || '0')
    
    // ═══ SANITY CHECK: Detect potential voltage/temp misreads
    // If TDS > 500 and voltage is in normal range (3-10V), likely wrong field mapping
    const isLikelyMisread = rawTds > 500 && voltage >= 3 && voltage <= 10
    const validatedTds = isLikelyMisread ? 0 : rawTds
    
    if (isLikelyMisread) {
        console.warn(`⚠️ Potential TDS misread detected: ${rawTds} (voltage: ${voltage}V). Flagged as invalid.`)
    }
    
    return {
        tds: validatedTds,
        temperature: temperature,
        voltage: voltage,
        timestamp: entry.created_at,
        entry_id: entry.entry_id
    }
}

// --- Public APIs ---

/**
 * Generate ThingSpeak chart embed URL
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
 */
export async function fetchThingSpeakData(
    config: ThingSpeakFetchConfig
): Promise<ThingSpeakResponse> {
    const {
        channelId,
        readApiKey,
        results = 100,
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

    const params = new URLSearchParams()
    if (readApiKey) params.append('api_key', readApiKey)
    if (results) params.append('results', Math.min(results, 8000).toString())
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (days) params.append('days', days.toString())
    if (minutes) params.append('minutes', minutes.toString())
    if (hours) params.append('hours', hours.toString())
    if (aggregation && aggregationInterval) params.append(aggregation, aggregationInterval.toString())
    if (timezone) params.append('timezone', timezone)
    if (offset !== undefined) params.append('offset', offset.toString())
    if (status) params.append('status', 'true')
    if (location) params.append('location', 'true')
    if (metadata) params.append('metadata', 'true')

    const url = `${BASE_URL}/channels/${channelId}/feeds.json?${params.toString()}`

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            headers: { 'Accept': 'application/json' }
        })

        if (!response.ok) {
            throw new Error(`ThingSpeak API error: ${response.status} ${response.statusText}`)
        }

        return await response.json()
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
 * Legacy support for fetchFeeds with TDS filtering
 */
export async function fetchFeeds(
    channelId: string | number,
    readKey: string,
    mapping: FieldMapping,
    results: number = 100
): Promise<ParsedSensorData[]> {
    const data = await fetchThingSpeakData({
        channelId,
        readApiKey: readKey,
        results
    })

    if (!data.feeds || data.feeds.length === 0) return []

    // Parse and filter
    const parsed = data.feeds.map(entry => parseEntry(entry, mapping))
    
    // STRICT FILTERING: Remove TDS <= 20 ppm (User requested to keep this)
    return parsed.filter(reading => reading.tds > 20)
}

/**
 * Fetch latest entry (most efficient for real-time)
 */
export async function fetchThingSpeakLatest(
    channelId: string | number,
    readApiKey?: string
): Promise<ThingSpeakEntry> {
    const params = new URLSearchParams()
    if (readApiKey) params.append('api_key', readApiKey)

    const url = `${BASE_URL}/channels/${channelId}/feeds/last.json?${params.toString()}`

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
            headers: { 'Accept': 'application/json' }
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
 * Legacy support for fetchLastEntry
 */
export async function fetchLastEntry(
    channelId: string | number,
    readKey: string,
    mapping: FieldMapping
): Promise<ParsedSensorData | null> {
    const entry = await fetchThingSpeakLatest(channelId, readKey)
    return entry ? parseEntry(entry, mapping) : null
}

/**
 * Fetch channel info
 */
export async function getChannelInfo(readKey: string): Promise<ThingSpeakResponse['channel'] | null> {
    try {
        const url = `${BASE_URL}/channels/read.json?api_key=${readKey}&results=1`
        const res = await fetch(url)
        if (!res.ok) return null
        const data: ThingSpeakResponse = await res.json()
        return data.channel
    } catch (e) {
        console.warn('Failed to fetch channel info', e)
        return null
    }
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

// --- Constants ---

export const THINGSPEAK_LIMITS = {
    REAL_TIME_MAX_RESULTS: 100,
    MAX_RESULTS: 8000,
    MIN_REQUEST_INTERVAL: 15000,
    FREE_ACCOUNT_DAILY_LIMIT: 8000,
    VALID_AGGREGATION_INTERVALS: [10, 15, 20, 30, 60, 240, 720, 1440] as const,
    DEFAULT_CHART_UPDATE: 15,
    MAX_FIELDS: 8
} as const
