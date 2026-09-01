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
 * Fetches the absolute latest reading for a specific device from ThingSpeak.
 * Uses the /feeds/last.json endpoint for maximum accuracy.
 */
export async function getLatestThingSpeakReading(device: Device): Promise<any | null> {
    if (!device.thingspeak_channel_id) return null;

    try {
        const channelId = device.thingspeak_channel_id;
        const readKey = device.thingspeak_read_key || '';
        
        // Fix: Use the dedicated 'last.json' endpoint and add a cache-buster
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json?api_key=${readKey}&_cb=${Date.now()}`;

        const response = await axios.get<ThingSpeakFieldData>(url, { timeout: 10000 });
        const feed = response.data;
        
        if (feed && feed.entry_id) {
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
        console.error(`❌ [ThingSpeak] Failed to fetch latest data for device ${device.id}:`, error.message);
        return null;
    }
}

/**
 * Tests connection to a ThingSpeak channel with given Read Key.
 * Returns metadata about the channel if successful.
 */
export async function testThingSpeakConnection(
    channelId: string,
    readKey: string
): Promise<{ success: boolean; channelName?: string; lastEntryId?: number; error?: string }> {
    if (!channelId || !channelId.trim()) {
        return { success: false, error: 'Channel ID is required' };
    }

    try {
        const cleanChannelId = channelId.trim();
        const cleanReadKey = (readKey || '').trim();
        const url = `https://api.thingspeak.com/channels/${cleanChannelId}/feeds/last.json?api_key=${cleanReadKey}&_cb=${Date.now()}`;

        const response = await axios.get(url, { timeout: 8000 });
        if (response.status === 200 && response.data) {
            return {
                success: true,
                lastEntryId: response.data.entry_id || 0,
            };
        }
        return { success: false, error: 'Channel returned empty response' };
    } catch (error: any) {
        if (error.response?.status === 404) {
            return { success: false, error: 'Channel ID not found or is private without a valid Read Key' };
        }
        if (error.response?.status === 400 || error.response?.status === 403) {
            return { success: false, error: 'Invalid ThingSpeak API Key' };
        }
        return { success: false, error: error.message || 'ThingSpeak connection request failed' };
    }
}

