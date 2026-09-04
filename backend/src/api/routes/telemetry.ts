import { Router, Request, Response, NextFunction } from 'express';
import * as telemetryService from '../../services/telemetryService';
import * as deviceService from '../../services/deviceService';
import { sseService } from '../../services/sseService';
import { ApiResponse } from '../../types';
import { validateBody } from '../../lib/validate';
import { telemetrySchema, telemetryBatchSchema } from '../schemas/telemetrySchemas';

const router = Router();

/**
 * Opt-in shared-secret gate for device telemetry submission.
 *
 * device_id values are publicly enumerable (GET /api/devices is intentionally
 * open), so without this, anyone could POST forged readings for any device —
 * spamming false critical alerts, or worse, masking a real contamination
 * event by submitting fake safe readings.
 *
 * Enforcement only activates once TELEMETRY_API_KEY is set. Left unset by
 * default so this doesn't brick real devices that haven't been reflashed to
 * send the header yet — see envVerifier.ts's startup warning when it's unset.
 */
function requireTelemetryKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.TELEMETRY_API_KEY;
  if (!expected) return next();

  const provided = req.headers['x-telemetry-key'];
  if (provided !== expected) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — missing or invalid x-telemetry-key header',
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

/**
 * POST /api/telemetry
 * Submit sensor data from a device
 */
router.post('/', requireTelemetryKey, validateBody(telemetrySchema), async (req: Request, res: Response) => {
  try {
    const { device_id, tds, temperature, voltage, recorded_at } = req.body;

    const updatedDevice = await telemetryService.processTelemetry({
      device_id,
      tds,
      temperature,
      voltage,
      recorded_at
    });

    // Broadcast live reading to connected SSE frontend clients
    sseService.broadcast('telemetry', {
      device_id,
      tds,
      temperature,
      voltage,
      status: updatedDevice.status,
      recorded_at: recorded_at || new Date().toISOString()
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
router.post('/batch', requireTelemetryKey, validateBody(telemetryBatchSchema), async (req: Request, res: Response) => {
  try {
    const { readings } = req.body;

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
/**
 * GET /api/telemetry/export
 * Export historical sensor telemetry as CSV or JSON
 * Query params: deviceId (required), format (csv|json, default: csv), limit (default: 500)
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string;
    const format = ((req.query.format as string) || 'csv').toLowerCase();
    const limit = parseInt(req.query.limit as string) || 500;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId query parameter is required',
        timestamp: new Date().toISOString(),
      });
    }

    const history = await deviceService.getDeviceSensorHistory(deviceId, limit);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="telemetry_${deviceId}.json"`);
      return res.json(history);
    }

    // CSV format
    let csv = 'Timestamp,Device ID,TDS (ppm),Temperature (°C),Voltage (V)\n';
    for (const row of history) {
      const r = row as any;
      const ts = r.recorded_at || r.timestamp || '';
      const tdsVal = r.payload?.tds ?? r.tds ?? '';
      const tempVal = r.payload?.temperature ?? r.temperature ?? '';
      const voltVal = r.payload?.voltage ?? r.voltage ?? '';
      csv += `"${ts}","${deviceId}",${tdsVal},${tempVal},${voltVal}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="telemetry_${deviceId}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting telemetry:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export telemetry',
      timestamp: new Date().toISOString(),
    });
  }
});
export default router;
