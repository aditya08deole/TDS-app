import { z } from 'zod';

export const createDeviceSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'name is required'),
  location_name: z.string().optional(),
  description: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  thingspeak_channel_id: z.string().optional(),
  thingspeak_read_key: z.string().optional(),
  thingspeak_write_key: z.string().optional(),
  node_number: z.string().optional(),
  sim_number: z.string().optional(),
  serial_number: z.string().optional(),
  tds_field_number: z.coerce.number().int().min(1).max(8).optional(),
  temperature_field_number: z.coerce.number().int().min(1).max(8).optional(),
  voltage_field_number: z.coerce.number().int().min(1).max(8).optional(),
  safe_tds_min: z.coerce.number().min(0).optional(),
  safe_tds_max: z.coerce.number().min(0).optional(),
  min_tds_threshold: z.coerce.number().min(0).optional(),
  max_tds_threshold: z.coerce.number().min(0).optional(),
  status: z.enum(['online', 'offline', 'critical', 'maintenance']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * PATCH /api/devices/:id allow-list. Deliberately built from createDeviceSchema
 * minus `id` — a field_engineer (the minimum role allowed to PATCH) can never
 * overwrite device identity, created_at, or any other audit/system field,
 * because those simply aren't in this schema and zod strips unknown keys.
 */
export const updateDeviceSchema = createDeviceSchema.partial().omit({ id: true });
