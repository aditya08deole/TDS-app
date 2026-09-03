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

export interface ExportedReading {
    recorded_at: string;
    tds: number;
    temperature: number;
    voltage: number;
}

const THINGSPEAK_MAX_RESULTS_PER_CALL = 8000; // ThingSpeak's own hard cap per request
const EXPORT_MAX_PAGES = 20; // safety ceiling: 20 * 8000 = up to 160k rows per export

/**
 * Fetches every reading for a device between start and end (inclusive),
 * transparently paginating past ThingSpeak's 8000-rows-per-call limit.
 *
 * ThingSpeak has no "next page" cursor — the standard way to page through a
 * large range is to re-issue the query with `start` moved to just after the
 * last entry's timestamp returned by the previous call, and stop once a call
 * returns fewer than the max (meaning we reached the end of the range).
 */
export async function getThingSpeakFeedsInRange(
    device: Device,
    startIso: string,
    endIso: string
): Promise<ExportedReading[]> {
    if (!device.thingspeak_channel_id) return [];

    const channelId = device.thingspeak_channel_id;
    const readKey = device.thingspeak_read_key || '';
    const tdsField = `field${device.tds_field_number || 1}`;
    const tempField = `field${device.temperature_field_number || 2}`;
    const voltField = `field${device.voltage_field_number || 3}`;

    // ThingSpeak expects "YYYY-MM-DD HH:MM:SS" (UTC), not full ISO 8601.
    const toThingSpeakDate = (iso: string) => iso.replace('T', ' ').replace(/\.\d{3}Z?$/, '').replace('Z', '');

    const results: ExportedReading[] = [];
    let cursorStart = startIso;

    for (let page = 0; page < EXPORT_MAX_PAGES; page++) {
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json` +
            `?api_key=${readKey}` +
            `&start=${encodeURIComponent(toThingSpeakDate(cursorStart))}` +
            `&end=${encodeURIComponent(toThingSpeakDate(endIso))}` +
            `&results=${THINGSPEAK_MAX_RESULTS_PER_CALL}`;

        const response = await axios.get<ThingSpeakResponse>(url, { timeout: 20000 });
        const feeds = response.data?.feeds || [];

        if (feeds.length === 0) break;

        for (const feed of feeds) {
            results.push({
                recorded_at: feed.created_at,
                tds: parseFloat(feed[tdsField]) || 0,
                temperature: parseFloat(feed[tempField]) || 0,
                voltage: parseFloat(feed[voltField]) || 0,
            });
        }

        if (feeds.length < THINGSPEAK_MAX_RESULTS_PER_CALL) break; // exhausted the range

        // Next page starts 1 second after the last entry we just received.
        const lastTimestamp = new Date(feeds[feeds.length - 1].created_at);
        lastTimestamp.setSeconds(lastTimestamp.getSeconds() + 1);
        cursorStart = lastTimestamp.toISOString();
    }

    return results;
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

