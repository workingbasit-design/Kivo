'use server';

import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  optimizeDayRouteForBusiness,
  type DayRouteResult,
} from '@/lib/route-optimizer';

export type OptimizeRouteActionResult =
  | ({ ok: true } & DayRouteResult)
  | { error: string };

/**
 * Server action: optimize the driving route for a business day using real
 * map data (Nominatim geocoding + OSRM driving times).
 *
 * Runs on demand only (the "Optimize route" button) so the free map APIs
 * are never hammered on page load. Results are tenant-scoped via
 * requireAuth, rate-limited, and never persisted to the database.
 */
export async function optimizeDayRoute(
  dateStr: string
): Promise<OptimizeRouteActionResult> {
  const { user, businessId } = await requireAuth();
  const rl = rateLimit(`routes:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { error: 'Invalid date.' };
  }
  try {
    const result = await optimizeDayRouteForBusiness(businessId, dateStr);
    return { ok: true, ...result };
  } catch {
    return { error: 'Route optimization failed. Please try again.' };
  }
}
