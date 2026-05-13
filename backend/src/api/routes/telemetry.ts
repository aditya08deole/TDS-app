import { Router, Request, Response } from 'express';
import * as telemetryService from '../../services/telemetryService';
import { ApiResponse } from '../../types';

const router = Router();

/**
 * POST /api/telemetry
 * Submit sensor data from a device
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { device_id, tds, temperature, voltage, recorded_at } = req.body;

    if (!device_id || tds === undefined) {
      return res.status(400).json({
        success: false,
        error: 'device_id and tds are required',
        timestamp: new Date().toISOString(),
      });
    }

    const updatedDevice = await telemetryService.processTelemetry({
      device_id,
      tds: Number(tds),
      temperature: temperature !== undefined ? Number(temperature) : undefined,
      voltage: voltage !== undefined ? Number(voltage) : undefined,
      recorded_at
    });

    res.status(200).json({
      success: true,
      data: {
        status: updatedDevice.status,
        last_tds: updatedDevice.last_tds
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Telemetry processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process telemetry',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/telemetry/batch
 * Submit multiple sensor readings at once (e.g. from a gateway)
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { readings } = req.body;

    if (!Array.isArray(readings)) {
      return res.status(400).json({
        success: false,
        error: 'readings must be an array',
        timestamp: new Date().toISOString(),
      });
    }

    const results = [];
    for (const data of readings) {
      try {
        await telemetryService.processTelemetry(data);
        results.push({ device_id: data.device_id, success: true });
      } catch (err: any) {
        results.push({ device_id: data.device_id, success: false, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Batch processing failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
