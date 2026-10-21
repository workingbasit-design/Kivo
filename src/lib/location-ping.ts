import { z } from 'zod';

/**
 * Validation for POST /api/locations/ping payloads.
 *
 * Extracted from the route so the schema is unit-testable
 * (src/lib/__tests__/location-ping.test.mts).
 *
 * Accuracy: 0 is a legitimate reading — desktop / Wi-Fi positioning can
 * report unknown accuracy as 0 — so the bound is >= 0, not positive.
 * Negative or absurd values are still rejected, as are out-of-range
 * coordinates.
 */
export const locationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
  jobId: z.string().min(1).max(64),
});

export type LocationPing = z.infer<typeof locationPingSchema>;
