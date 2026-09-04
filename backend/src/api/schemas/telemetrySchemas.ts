import { z } from 'zod';

export const telemetrySchema = z.object({
  device_id: z.string().min(1, 'device_id is required'),
  tds: z.coerce.number().min(0).max(100000),
  temperature: z.coerce.number().min(-40).max(150).optional(),
  voltage: z.coerce.number().min(0).max(50).optional(),
  recorded_at: z.string().optional(),
});

export const telemetryBatchSchema = z.object({
  readings: z.array(telemetrySchema).min(1, 'readings must contain at least one entry').max(500),
});
