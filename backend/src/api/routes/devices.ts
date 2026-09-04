import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import * as deviceService from '../../services/deviceService';
import { getThingSpeakFeedsInRange } from '../../services/thingSpeakService';
import { getFirestore } from 'firebase-admin/firestore';
import { ApiResponse, Device } from '../../types';
import { requireRole } from '../middleware/roleGuard';
import { validateBody } from '../../lib/validate';
import { createDeviceSchema, updateDeviceSchema } from '../schemas/deviceSchemas';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTANT: All static/named routes MUST be declared BEFORE parameterized
// routes like /:id to prevent Express from matching "search", "stats",
// "system" etc. as device IDs. (Fix #12, #13)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/devices
 * Get all devices from Firestore (via device service)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices = await deviceService.getAllDevices();

    const response: ApiResponse<Device[]> = {
      success: true,
      data: devices,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/search?q=query
 * Search devices — MUST be before /:id
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
        timestamp: new Date().toISOString(),
      });
    }

    const devices = await deviceService.searchDevices(q);

    res.json({
      success: true,
      data: devices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error searching devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search devices',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/stats/all
 * Get device statistics — MUST be before /:id
 */
router.get('/stats/all', async (req: Request, res: Response) => {
  try {
    const stats = await deviceService.getDeviceStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/system/health
 * Get historical system health logs — MUST be before /:id
 */
router.get('/system/health', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const data = await deviceService.getSystemHealthLogs(limit);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching system health logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health logs',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/system/uptime
 * Get uptime stats — MUST be before /:id
 */
router.get('/system/uptime', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string;
    const data = await deviceService.getUptimeStats(deviceId);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching uptime stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch uptime stats',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/status/:status
 * Get devices by status — MUST be before /:id
 */
router.get('/status/:status', async (req: Request, res: Response) => {
  try {
    const validStatuses = ['online', 'offline', 'critical', 'maintenance'];
    const status = req.params.status.toLowerCase();

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const devices = await deviceService.getDevicesByStatus(status);

    res.json({
      success: true,
      data: devices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching devices by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices',
      timestamp: new Date().toISOString(),
    });
  }
});


/**
 * POST /api/devices/test-thingspeak
 * Test ThingSpeak Channel ID & Read Key validity before saving
 */
router.post('/test-thingspeak', async (req: Request, res: Response) => {
  try {
    const { channelId, readKey } = req.body;
    const { testThingSpeakConnection } = await import('../../services/thingSpeakService');
    
    const result = await testThingSpeakConnection(channelId, readKey);
    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test ThingSpeak connection',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/telemetry/live
 * Batched endpoint returning all devices enriched with latest live telemetry from Redis/Firestore.
 * Replaces 50 individual client-side HTTP queries with 1 single request.
 */
router.get('/telemetry/live', async (req: Request, res: Response) => {
  try {
    const devices = await deviceService.getAllDevices();
    const { getRedisClient } = await import('../../db/redis');
    const redis = getRedisClient();

    const enriched = await Promise.all(devices.map(async (device) => {
      let cached = null;
      try {
        cached = await redis.hGetAll(`device:${device.id}`);
      } catch {
        // Fallback to device record
      }

      const latest_tds = cached?.last_tds != null ? parseFloat(cached.last_tds) : (device.last_tds ?? undefined);
      const latest_temp = cached?.last_temp != null ? parseFloat(cached.last_temp) : (device.last_temperature ?? undefined);
      const latest_volt = cached?.last_voltage != null ? parseFloat(cached.last_voltage) : (device.last_voltage ?? undefined);
      const last_reading = cached?.last_reading_at || device.last_reading_at || device.last_seen_at;

      return {
        ...device,
        latest_tds,
        latest_temperature: latest_temp,
        latest_voltage: latest_volt,
        last_reading_at: last_reading,
        status: cached?.status || device.status || 'offline',
      };
    }));

    res.json({
      success: true,
      total: enriched.length,
      data: enriched,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching batched live telemetry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batched live telemetry',
      timestamp: new Date().toISOString(),
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETERIZED ROUTES — declared after all static routes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/devices
 * Create a new device (admin+ only — matches the 'add_device' permission)
 */
router.post('/', requireRole('admin'), validateBody(createDeviceSchema), async (req: Request, res: Response) => {
  try {
    const deviceData = req.body;

    const device = await deviceService.createDevice(deviceData);

    res.status(201).json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create device',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/:id
 * Get single device by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const device = await deviceService.getDeviceWithRecentData(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/:id/sensor-data
 * Get historical sensor readings from Redis
 */
router.get('/:id/sensor-data', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const data = await deviceService.getDeviceSensorHistory(req.params.id, limit);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sensor data',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/:id/health-events
 * Get historical health events (alerts) from Firestore
 */
router.get('/:id/health-events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await deviceService.getDeviceHealthEvents(req.params.id, limit);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching health events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health events',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/devices/:id/export?start=<ISO>&end=<ISO>&format=csv|json
 *
 * Downloads a device's historical readings for a date range, sourced live
 * from ThingSpeak (the actual system of record for history here — this app
 * only mirrors the LATEST reading per device, it doesn't keep its own full
 * history). Transparently pages past ThingSpeak's 8000-rows-per-call limit,
 * so a wide date range just works from the caller's side.
 *
 * Restricted to admin/super_admin — matches the 'export_data' permission
 * in the frontend's RoleContext, which field_engineer and viewer do not
 * have. Bulk historical data is treated as a step up from just viewing
 * live readings on screen.
 */
router.get('/:id/export', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    const requestedFormat = req.query.format as string;
    const format = requestedFormat === 'json' ? 'json' : requestedFormat === 'excel' ? 'excel' : 'csv';

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'start and end query params are required (ISO 8601 dates)',
        timestamp: new Date().toISOString(),
      });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range — start must be a valid date before end',
        timestamp: new Date().toISOString(),
      });
    }

    const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > ONE_YEAR_MS) {
      return res.status(400).json({
        success: false,
        error: 'Date range too large — please request 1 year or less at a time',
        timestamp: new Date().toISOString(),
      });
    }

    const device = await deviceService.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        timestamp: new Date().toISOString(),
      });
    }

    if (!device.thingspeak_channel_id) {
      return res.status(400).json({
        success: false,
        error: 'This device has no ThingSpeak channel configured — nothing to export',
        timestamp: new Date().toISOString(),
      });
    }

    const readings = await getThingSpeakFeedsInRange(device, startDate.toISOString(), endDate.toISOString());

    // Audit trail — matches the pattern already used for invites/role changes,
    // so "who exported what, when" is answerable later if it ever matters.
    const requester = req.user;
    getFirestore().collection('audit_log').add({
      action: 'device_data_exported',
      device_id: device.id,
      device_name: device.name,
      exported_by: requester?.uid,
      exported_by_role: requester?.role,
      range_start: startDate.toISOString(),
      range_end: endDate.toISOString(),
      row_count: readings.length,
      format,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    const safeName = (device.location_name || device.name || device.id).replace(/[^a-z0-9]+/gi, '-');
    const fileDate = `${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}`;
    const extension = format === 'excel' ? 'xlsx' : format;
    const filename = `${safeName}_${fileDate}.${extension}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(JSON.stringify({ device: device.name, location: device.location_name, readings }, null, 2));
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'EvaraTDS';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Readings', {
        views: [{ state: 'frozen', ySplit: 1 }], // freeze the header row
      });

      sheet.columns = [
        { header: 'Timestamp', key: 'recorded_at', width: 22 },
        { header: 'TDS (ppm)', key: 'tds', width: 14 },
        { header: 'Temperature (°C)', key: 'temperature', width: 18 },
        { header: 'Voltage (V)', key: 'voltage', width: 14 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { vertical: 'middle' };
      sheet.autoFilter = { from: 'A1', to: 'D1' };

      for (const r of readings) {
        sheet.addRow({ recorded_at: r.recorded_at, tds: r.tds, temperature: r.temperature, voltage: r.voltage });
      }

      // A small metadata sheet — device identity travels with the file
      // instead of only living in the filename, useful once it's been
      // renamed/moved/emailed around.
      const infoSheet = workbook.addWorksheet('Device Info');
      infoSheet.columns = [{ key: 'label', width: 18 }, { key: 'value', width: 40 }];
      infoSheet.addRows([
        { label: 'Device', value: device.name },
        { label: 'Location', value: device.location_name || '—' },
        { label: 'ThingSpeak Channel', value: device.thingspeak_channel_id },
        { label: 'Range Start', value: startDate.toISOString() },
        { label: 'Range End', value: endDate.toISOString() },
        { label: 'Rows', value: readings.length },
      ]);
      infoSheet.getColumn('label').font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    }

    // CSV — quote every field and escape embedded quotes, the only two things
    // that actually need it for these column types (timestamp + 3 numbers).
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ['Timestamp', 'TDS (ppm)', 'Temperature (°C)', 'Voltage (V)'].map(escapeCsv).join(',');
    const rows = readings.map(r => [r.recorded_at, r.tds, r.temperature, r.voltage].map(escapeCsv).join(','));
    const csv = [header, ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error: any) {
    console.error('Error exporting device data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export device data',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/devices/:id/tds-thresholds
 * Update device TDS thresholds (field_engineer+ — matches 'edit_device' permission)
 */
router.put('/:id/tds-thresholds', requireRole('field_engineer'), async (req: Request, res: Response) => {
  try {
    const { min_tds, max_tds } = req.body;

    if (typeof min_tds !== 'number' || typeof max_tds !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'min_tds and max_tds must be numbers',
        timestamp: new Date().toISOString(),
      });
    }

    if (min_tds < 0 || max_tds < min_tds || max_tds > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid TDS range. Min >= 0, Max >= Min, Max <= 10000',
        timestamp: new Date().toISOString(),
      });
    }

    const device = await deviceService.updateDeviceTdsThresholds(req.params.id, min_tds, max_tds);

    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating TDS thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update TDS thresholds',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/devices/:id/status
 * Update device status (field_engineer+ — matches 'maintenance_mode' permission)
 */
router.put('/:id/status', requireRole('field_engineer'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['online', 'offline', 'critical', 'maintenance'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const device = await deviceService.updateDeviceStatus(req.params.id, status);

    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PATCH /api/devices/:id
 * Update an existing device (field_engineer+ — matches 'edit_device' permission)
 */
router.patch('/:id', requireRole('field_engineer'), validateBody(updateDeviceSchema), async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id;
    const updates = req.body;

    const device = await deviceService.updateDevice(deviceId, updates);

    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`Error updating device ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update device',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/devices/:id
 * Delete a device (admin+ only — matches the 'delete_device' permission)
 */
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await deviceService.deleteDevice(req.params.id);

    res.json({
      success: true,
      message: 'Device deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete device',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
