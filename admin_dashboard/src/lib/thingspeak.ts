export interface ThingSpeakEntry {
    created_at: string
    entry_id: number
    field1?: string // TDS
    field2?: string // Temperature
    field3?: string // Voltage/Battery
    field4?: string
    field5?: string
    field6?: string
    field7?: string
    field8?: string
}

export interface ThingSpeakFeed {
    channel: {
        id: number
        name: string
        latitude: string
        longitude: string
        field1: string
        field2: string
        updated_at: string
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

const BASE_URL = 'https://api.thingspeak.com'


/**
 * Get field value from ThingSpeak entry based on field number
 */
function getFieldValue(entry: ThingSpeakEntry, fieldNumber: number): string | undefined {
    return entry[`field${fieldNumber}` as keyof ThingSpeakEntry] as string | undefined
}

/**
 * Parse ThingSpeak entry with custom field mapping
 */
function parseEntry(entry: ThingSpeakEntry, mapping: FieldMapping): ParsedSensorData {
    return {
        tds: parseFloat(getFieldValue(entry, mapping.tds) || '0'),
        temperature: parseFloat(getFieldValue(entry, mapping.temperature) || '0'),
        voltage: parseFloat(getFieldValue(entry, mapping.voltage) || '0'),
        timestamp: entry.created_at,
        entry_id: entry.entry_id
    }
}

/**
 * Fetches historical feeds for a channel.
 * ThingSpeak API requires channel ID in the URL path.
 * 
 * @param channelId ThingSpeak Channel ID (stored in device record)
 * @param readKey Read API Key  
 * @param mapping Field mapping configuration
 * @param results Number of results to fetch (default 100)
 */
export async function fetchFeeds(
    channelId: string | number,
    readKey: string,
    mapping: FieldMapping,
    results: number = 100
): Promise<ParsedSensorData[]> {
    if (!channelId || !readKey) {
        console.warn('Missing channelId or readKey')
        return []
    }

    try {
        // ThingSpeak API requires: /channels/{CHANNEL_ID}/feeds.json?api_key={READ_KEY}
        const url = `${BASE_URL}/channels/${channelId}/feeds.json?api_key=${readKey}&results=${results}`
        console.log('Fetching ThingSpeak data from:', url)

        const res = await fetch(url, {
            signal: AbortSignal.timeout(15000)
        })

        if (!res.ok) {
            console.warn(`ThingSpeak API error: ${res.status} ${res.statusText}`)
            return []
        }

        const data: ThingSpeakFeed = await res.json()

        if (!data.feeds || data.feeds.length === 0) {
            console.warn('No feeds in ThingSpeak response')
            return []
        }

        console.log(`✅ Fetched ${data.feeds.length} readings from ThingSpeak channel ${channelId}`)

        // Parse all entries with field mapping
        const parsed = data.feeds.map(entry => parseEntry(entry, mapping))

        // STRICT FILTERING: Remove all TDS <= 20 ppm (invalid/noise readings)
        // This ensures zeros and low values are removed from charts and calculations
        const validReadings = parsed.filter(reading => reading.tds > 20)

        console.log(`✅ After filtering TDS <= 20: ${validReadings.length} valid readings`)
        return validReadings

    } catch (e) {
        console.warn('Failed to fetch ThingSpeak feeds:', e)
        return []
    }
}

/**
 * Fetches the latest entry for a specific channel.
 * @param channelId ThingSpeak Channel ID
 * @param readKey Read API Key
 * @param mapping Field mapping configuration
 */
export async function fetchLastEntry(
    channelId: string | number,
    readKey: string,
    mapping: FieldMapping
): Promise<ParsedSensorData | null> {
    if (!channelId || !readKey) return null

    try {
        const url = `${BASE_URL}/channels/${channelId}/feeds/last.json?api_key=${readKey}`
        const res = await fetch(url, {
            signal: AbortSignal.timeout(10000)
        })
        if (!res.ok) return null
        const entry: ThingSpeakEntry = await res.json()
        return parseEntry(entry, mapping)
    } catch (e) {
        console.warn('Failed to fetch last entry:', e)
        return null
    }
}

/**
 * Get channel info
 */
export async function getChannelInfo(readKey: string): Promise<ThingSpeakFeed['channel'] | null> {
    try {
        const url = `${BASE_URL}/channels/read.json?api_key=${readKey}&results=1`
        const res = await fetch(url)
        if (!res.ok) return null
        const data: ThingSpeakFeed = await res.json()
        return data.channel
    } catch (e) {
        console.warn('Failed to fetch channel info', e)
        return null
    }
}

