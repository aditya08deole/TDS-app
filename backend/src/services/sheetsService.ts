import fs from 'fs';
import path from 'path';
import { google, sheets_v4 } from 'googleapis';

/**
 * Logs every dispatched TDS alert notification into a shared Google Sheet —
 * one tab per plant/device, one row per notification — so ops can audit
 * "who got notified about what, and when" outside Firestore. Entirely
 * best-effort: any failure here (missing credentials, sheet not shared yet,
 * API hiccup) is caught and logged, never thrown, so it can never take down
 * an actual push notification send.
 */

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_NOTIFICATION_LOG_ID || '';
const HEADER_ROW = ['Timestamp', 'TDS Level (ppm)', 'Alert Type', 'Notification'];

let sheetsClient: sheets_v4.Sheets | null | undefined; // undefined = not yet attempted, null = unavailable
let warnedUnconfigured = false;

// Tabs we've already confirmed exist this process — avoids a spreadsheets.get
// round-trip on every single notification.
const knownTabs = new Set<string>();

function loadCredentials(): object | null {
    const rawKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
        let keyStr = rawKey.trim();
        if (!keyStr.startsWith('{')) {
            keyStr = Buffer.from(keyStr, 'base64').toString('utf8');
        }
        return JSON.parse(keyStr);
    }

    const filePath = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH
        || path.resolve(__dirname, '../../google-sheets-service-account.json');
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    return null;
}

function getSheetsClient(): sheets_v4.Sheets | null {
    if (sheetsClient !== undefined) return sheetsClient;

    try {
        if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEETS_NOTIFICATION_LOG_ID not set');
        const credentials = loadCredentials();
        if (!credentials) throw new Error('no service account credentials found');

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        sheetsClient = google.sheets({ version: 'v4', auth });
        console.log('📊 [Sheets] Notification log ready');
    } catch (err: any) {
        sheetsClient = null;
        if (!warnedUnconfigured) {
            console.warn(`📊 [Sheets] Notification logging disabled — ${err.message}`);
            warnedUnconfigured = true;
        }
    }

    return sheetsClient;
}

// Sheets tab titles: max 100 chars, and can't contain [ ] * ? / \ : or be blank.
function sanitizeTabName(name: string): string {
    const cleaned = (name || '').replace(/[[\]*?/\\:]/g, '-').trim();
    return (cleaned || 'Unknown Plant').slice(0, 95);
}

async function ensureTabExists(sheets: sheets_v4.Sheets, tabName: string): Promise<void> {
    if (knownTabs.has(tabName)) return;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingTitles = new Set((spreadsheet.data.sheets || []).map(s => s.properties?.title));
    existingTitles.forEach(t => { if (t) knownTabs.add(t); });

    if (knownTabs.has(tabName)) return;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [{ addSheet: { properties: { title: tabName } } }],
        },
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADER_ROW] },
    });

    knownTabs.add(tabName);
    console.log(`📊 [Sheets] Created new plant tab: "${tabName}"`);
}

export async function logNotificationToSheet(params: {
    plantName: string;
    tdsValue: number | string;
    alertType: string;
    timestampIST: string;
}): Promise<void> {
    const sheets = getSheetsClient();
    if (!sheets) return;

    try {
        const tabName = sanitizeTabName(params.plantName);
        await ensureTabExists(sheets, tabName);

        const readableType = params.alertType === 'TDS_HIGH' ? 'High'
            : params.alertType === 'TDS_LOW' ? 'Low'
            : params.alertType || 'Unknown';

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${tabName}'!A:D`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [[params.timestampIST, params.tdsValue, readableType, 1]],
            },
        });
    } catch (err: any) {
        console.warn(`📊 [Sheets] Failed to log notification for "${params.plantName}": ${err.message}`);
    }
}
