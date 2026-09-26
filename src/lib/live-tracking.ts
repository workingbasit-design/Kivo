/**
 * Shared live-tracking snapshot builder, used by both the public
 * /track/[token] page (initial paint) and /api/track/[token]/ping (polling).
 * Best-effort throughout: distance/ETA are omitted when the job address
 * can't be geocoded, and nothing here ever throws for bad data.
 */

import { prisma } from '@/lib/prisma';
import {
  geocodeAddress,
  detectArrival,
  ARRIVAL_RADIUS_M,
} from '@/lib/geofence';
import { fetchDrivingEta, straightLineMeters } from '@/lib/eta';

export interface LiveSnapshot {
  lat: number;
  lng: number;
  /** ISO string — the client formats it in the viewer's timezone. */
  recordedAt: string;
  straightM: number | null;
  driveM: number | null;
  driveS: number | null;
  arrived: boolean;
}

/**
 * Latest ping for a job plus distance/ETA to the job address.
 * Returns null when no ping has been shared yet.
 */
export async function getLiveSnapshot(
  businessId: string,
  jobId: string,
  jobAddress: string | null | undefined
): Promise<LiveSnapshot | null> {
  const latest = await prisma.technicianLocation.findFirst({
    where: { jobId, businessId },
    orderBy: { recordedAt: 'desc' },
    select: { lat: true, lng: true, recordedAt: true },
  });
  if (!latest) return null;

  let straightM: number | null = null;
  let driveM: number | null = null;
  let driveS: number | null = null;
  let arrived = false;

  if (jobAddress) {
    const dest = await geocodeAddress(jobAddress);
    if (dest) {
      straightM = straightLineMeters(
        latest.lat,
        latest.lng,
        dest.lat,
        dest.lng
      );
      const arrival = detectArrival(
        { lat: latest.lat, lng: latest.lng },
        dest,
        ARRIVAL_RADIUS_M
      );
      arrived = arrival?.arrived ?? false;
      if (!arrived) {
        const eta = await fetchDrivingEta(
          latest.lat,
          latest.lng,
          dest.lat,
          dest.lng
        );
        if (eta) {
          driveM = eta.distanceM;
          driveS = eta.durationS;
        }
      }
    }
  }

  return {
    lat: latest.lat,
    lng: latest.lng,
    recordedAt: latest.recordedAt.toISOString(),
    straightM,
    driveM,
    driveS,
    arrived,
  };
}
