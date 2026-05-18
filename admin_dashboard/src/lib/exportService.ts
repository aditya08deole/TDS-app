/**
 * Data Export Service
 * Fix #10: Export data as CSV with Capacitor Filesystem support for Android app
 *
 * Features:
 * - CSV export for devices, alerts, sensor data
 * - Browser download + Android app save to Downloads
 * - Formatted tables with headers
 * - Timestamp and file naming
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { storage } from './storage';

/**
 * Export device data to CSV
 */
export async function exportDevicesCSV(
  devices: Array<{ id: string; name: string; location?: string; status?: string; last_tds?: number; [key: string]: any }>
): Promise<void> {
  const headers = ['Device ID', 'Name', 'Location', 'Status', 'Last TDS', 'Created'];
  const rows = devices.map(d => [
    d.id,
    d.name,
    d.location || 'N/A',
    d.status || 'unknown',
    d.last_tds?.toString() || 'N/A',
    d.created_at ? new Date(d.created_at).toLocaleDateString() : 'N/A'
  ]);

  await saveCSV(
    `evara_devices_${new Date().toISOString().split('T')[0]}.csv`,
    headers,
    rows,
    'Devices Export'
  );
}

/**
 * Export alerts data to CSV
 */
export async function exportAlertsCSV(
  alerts: Array<{ id: string; device_name?: string; severity?: string; message?: string; created_at?: string; status?: string; [key: string]: any }>
): Promise<void> {
  const headers = ['Alert ID', 'Device', 'Severity', 'Message', 'Status', 'Created'];
  const rows = alerts.map(a => [
    a.id,
    a.device_name || 'Unknown',
    a.severity || 'info',
    a.message || 'N/A',
    a.status || 'open',
    a.created_at ? new Date(a.created_at).toLocaleString() : 'N/A'
  ]);

  await saveCSV(
    `evara_alerts_${new Date().toISOString().split('T')[0]}.csv`,
    headers,
    rows,
    'Alerts Export'
  );
}

/**
 * Export uptime/analytics data to CSV
 */
export async function exportAnalyticsCSV(
  data: Array<{ device_name?: string; uptime_percent?: number; outage_count?: number; total_tracked_seconds?: number; [key: string]: any }>
): Promise<void> {
  const headers = ['Device', 'Uptime %', 'Outages', 'Total Time (hrs)', 'Status'];
  const rows = data.map(d => [
    d.device_name || 'Unknown',
    d.uptime_percent?.toFixed(2) || 'N/A',
    d.outage_count?.toString() || '0',
    d.total_tracked_seconds ? (d.total_tracked_seconds / 3600).toFixed(1) : 'N/A',
    (d.uptime_percent || 0) > 95 ? 'Good' : 'Fair'
  ]);

  await saveCSV(
    `evara_analytics_${new Date().toISOString().split('T')[0]}.csv`,
    headers,
    rows,
    'Analytics Export'
  );
}

/**
 * Export sensor data to CSV
 */
export async function exportSensorDataCSV(
  data: Array<{ device_name?: string; tds?: number; temperature?: number; voltage?: number; recorded_at?: string; [key: string]: any }>
): Promise<void> {
  const headers = ['Device', 'TDS (ppm)', 'Temperature (°C)', 'Voltage (V)', 'Recorded'];
  const rows = data.map(d => [
    d.device_name || 'Unknown',
    d.tds?.toString() || 'N/A',
    d.temperature?.toFixed(1) || 'N/A',
    d.voltage?.toFixed(2) || 'N/A',
    d.recorded_at ? new Date(d.recorded_at).toLocaleString() : 'N/A'
  ]);

  await saveCSV(
    `evara_sensor_data_${new Date().toISOString().split('T')[0]}.csv`,
    headers,
    rows,
    'Sensor Data Export'
  );
}

/**
 * Core CSV save function - handles both web and native Android
 */
async function saveCSV(
  filename: string,
  headers: string[],
  rows: string[][],
  exportType: string
): Promise<void> {
  try {
    // Build CSV content
    const csvContent = [
      `# ${exportType} - Generated on ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    console.log(`[EXPORT] Exporting ${rows.length} rows to ${filename}`);

    if (Capacitor.isNativePlatform()) {
      // Native Android app - save to app's Documents directory (visible as Downloads)
      await saveToAndroid(filename, csvContent);
    } else {
      // Web browser - trigger download
      saveToWeb(filename, csvContent);
    }

    // Store export metadata
    await storage.set('last_export', JSON.stringify({
      filename,
      type: exportType,
      timestamp: new Date().toISOString(),
      rows: rows.length
    }));

    console.log(`✅ [EXPORT] Successfully exported ${rows.length} rows`);
  } catch (error) {
    console.error('❌ [EXPORT] Failed:', error);
    throw new Error(`Export failed: ${(error as any).message}`);
  }
}

/**
 * Save CSV to Android filesystem (Capacitor)
 */
async function saveToAndroid(filename: string, csvContent: string): Promise<void> {
  try {
    console.log(`[EXPORT-ANDROID] Saving to ${filename}`);

    // Write to app's Documents directory (shows in Downloads on Android)
    await Filesystem.writeFile({
      path: filename,
      data: csvContent,
      directory: Directory.Documents,
      recursive: true,
    });

    console.log(`✅ [EXPORT-ANDROID] Saved to Documents/${filename}`);
    
    // Optional: notify user via storage
    await storage.set('export_location', `Documents/${filename}`);
  } catch (error) {
    console.error('❌ [EXPORT-ANDROID] Failed:', error);
    throw error;
  }
}

/**
 * Save CSV to web browser download
 */
function saveToWeb(filename: string, csvContent: string): void {
  try {
    console.log(`[EXPORT-WEB] Downloading ${filename}`);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup URL
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log(`✅ [EXPORT-WEB] Downloaded ${filename}`);
  } catch (error) {
    console.error('❌ [EXPORT-WEB] Failed:', error);
    throw error;
  }
}

/**
 * Get last export info
 */
export async function getLastExport(): Promise<{
  filename?: string;
  type?: string;
  timestamp?: string;
  rows?: number;
} | null> {
  const json = await storage.get('last_export');
  if (!json) return null;
  
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Format number with thousand separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format date for export
 */
export function formatExportDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Validate CSV data before export
 */
export function validateCSVData(rows: string[][]): { valid: boolean; error?: string } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, error: 'No data to export' };
  }

  if (!rows.every(row => Array.isArray(row))) {
    return { valid: false, error: 'Invalid row format' };
  }

  return { valid: true };
}

export default {
  exportDevicesCSV,
  exportAlertsCSV,
  exportAnalyticsCSV,
  exportSensorDataCSV,
  getLastExport,
  formatNumber,
  formatExportDate,
  validateCSVData,
};
