import { Router, Request, Response } from 'express';
import * as deviceService from '../../services/deviceService';
import { ApiResponse, Device } from '../../types';

const router = Router();

/**
 * GET /api/devices
 * Get all devices from local PostgreSQL cache
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
 * GET /api/devices/search?q=query
 * Search devices
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
 * GET /api/devices/status/:status
 * Get devices by status
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
 * GET /api/devices/stats/all
 * Get device statistics
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
