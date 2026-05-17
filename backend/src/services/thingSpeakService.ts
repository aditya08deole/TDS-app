import axios from 'axios';
import { Device } from '../types';

/**
 * ThingSpeak API Service
 * Bypasses the frontend to fetch real-time sensor data directly from the server.
 */

export interface ThingSpeakFieldData {
    created_at: string;
    entry_id: number;
    [key: string]: any;
}

export interface ThingSpeakResponse {
    channel: any;
    feeds: ThingSpeakFieldData[];
}

/**
 * Fetches the latest reading for a specific device from ThingSpeak
 */
export async function getLatestThingSpeakReading(device: Device): Promise<any | null> {
    if (!device.thingspeak_channel_id) return null;

    try {
        const channelId = device.thingspeak_channel_id;
        const readKey = device.thingspeak_read_key || '';
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=1`;

        const response = await axios.get<ThingSpeakResponse>(url, { timeout: 10000 });
        
        if (response.data.feeds && response.data.feeds.length > 0) {
            const feed = response.data.feeds[0];
            const tdsField = `field${device.tds_field_number || 1}`;
            const tempField = `field${device.temperature_field_number || 2}`;
            const voltField = `field${device.voltage_field_number || 3}`;

            return {
                tds: parseFloat(feed[tdsField]) || 0,
                temperature: parseFloat(feed[tempField]) || 0,
                voltage: parseFloat(feed[voltField]) || 0,
                recorded_at: feed.created_at
            };
        }
        return null;
    } catch (error: any) {
        console.error(`❌ [ThingSpeak] Failed to fetch data for device ${device.id}:`, error.message);
        return null;
    }
}
