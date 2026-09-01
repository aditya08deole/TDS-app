import { Router, Request, Response } from 'express';
import * as deviceService from '../../services/deviceService';
import { ApiResponse, Device } from '../../types';

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
 * Create a new device
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const deviceData = req.body;

    if (!deviceData.name) {
      return res.status(400).json({
        success: false,
        error: 'Device name is required',
        timestamp: new Date().toISOString(),
      });
    }

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
 * PUT /api/devices/:id/tds-thresholds
 * Update device TDS thresholds
 */
router.put('/:id/tds-thresholds', async (req: Request, res: Response) => {
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
 * Update device status
 */
router.put('/:id/status', async (req: Request, res: Response) => {
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
 * Update an existing device
 */
router.patch('/:id', async (req: Request, res: Response) => {
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
 * Delete a device
 */
router.delete('/:id', async (req: Request, res: Response) => {
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
