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

const BASE_URL = 'https://api.thingspeak.com'

/**
 * Fetches the latest entry for a specific channel.
 * @param channelId ThingSpeak Channel ID
 * @param readKey Read API Key (Optional for public channels)
 */
export async function fetchLastEntry(channelId: number, readKey?: string): Promise<ThingSpeakEntry | null> {
    try {
        const url = `${BASE_URL}/channels/${channelId}/feeds/last.json?api_key=${readKey || ''}`
        const res = await fetch(url)
        if (!res.ok) return null
        return await res.json()
    } catch (e) {
        console.warn(`Failed to fetch last entry for channel ${channelId}`, e)
        return null
    }
}

/**
 * Fetches historical feeds for a channel.
 * @param channelId ThingSpeak Channel ID
 * @param readKey Read API Key
 * @param results Number of results to fetch (default 100)
 */
export async function fetchFeeds(channelId: number, readKey?: string, results: number = 24): Promise<ThingSpeakFeed | null> {
    try {
        const url = `${BASE_URL}/channels/${channelId}/feeds.json?api_key=${readKey || ''}&results=${results}`
        const res = await fetch(url)
        if (!res.ok) return null
        return await res.json()
    } catch (e) {
        console.warn(`Failed to fetch feeds for channel ${channelId}`, e)
        return null
    }
}
