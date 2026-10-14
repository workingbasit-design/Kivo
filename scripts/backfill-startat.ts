/**
 * Backfill Job.startAt from legacy Job.date + Job.time.
 *
 * Part A (A2) migration helper. Converts existing date+time values into
 * the canonical `startAt` timestamptz, interpreted in the business timezone.
 *
 * Time parsing:
 *   "09:00"    -> 09:00
 *   "10:00 AM" -> 10:00
 *   "2:30 PM"  -> 14:30
 *   "10:00"    -> 10:00
 *
 * Rows whose time cannot be parsed are LOGGED and SKIPPED — never guessed.
 * Jobs with no time (timeTbd) get startAt = date at midnight in the
 * business timezone with timeTbd = true.
 *
 * SAFETY: This script is idempotent (only touches rows where startAt IS NULL).
 * It is intended for local/staging databases. Do NOT run against production
 * without explicit approval and a backup.
 *
 * Usage:
 *   npx tsx scripts/backfill-startat.ts [--dry-run]
 *
 * With --dry-run: prints what WOULD change, writes nothing.
 */

import { prisma } from '../src/lib/prisma';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Parse a legacy time string into { hours, minutes }.
 * Returns null when unparseable — caller must log and skip.
 */
function parseLegacyTime(raw: string | null | undefined): { hours: number; minutes: number } | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === '') return null;

  // "10:00 AM" / "2:30 PM" (12-hour with meridiem)
  const m12 = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(s);
  if (m12) {
    let hours = Number(m12[1]);
    const minutes = Number(m12[2]);
    const meridiem = m12[3].toUpperCase();
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // "09:00" / "9:00" (24-hour)
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m24) {
    const hours = Number(m24[1]);
    const minutes = Number(m24[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

/**
 * Combine a calendar date + wall-clock time into a UTC Date,
 * interpreting the wall time in the given IANA timezone.
 * Uses Intl to compute the offset (DST-aware).
 */
function zonedTimeToUtc(
  year: number,
  month: number, // 1-based
  day: number,
  hours: number,
  minutes: number,
  timeZone: string
): Date {
  // Guess UTC, then correct by the zone offset at that instant (iterated once for DST).
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const offsetMs = (dt: Date): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(dt);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - dt.getTime();
  };
  return new Date(guess.getTime() - offsetMs(guess));
}

async function main() {
  console.log(`backfill-startat: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);

  const jobs = await prisma.job.findMany({
    where: { startAt: null },
    select: {
      id: true,
      date: true,
      time: true,
      businessId: true,
      business: { select: { timezone: true } },
    },
  });
  console.log(`Found ${jobs.length} jobs with startAt NULL.`);

  let updated = 0;
  let skippedNoTime = 0;
  const unparseable: Array<{ id: string; time: string | null }> = [];

  for (const job of jobs) {
    const tz = job.business?.timezone ?? 'America/Toronto';
    const d = job.date;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    const parsed = parseLegacyTime(job.time);
    if (!parsed) {
      if (job.time == null || job.time.trim() === '') {
        // No time at all: midnight in business tz, mark timeTbd.
        const startAt = zonedTimeToUtc(year, month, day, 0, 0, tz);
        if (!DRY_RUN) {
          await prisma.job.update({
            where: { id: job.id },
            data: { startAt, timeTbd: true },
          });
        }
        skippedNoTime++;
      } else {
        unparseable.push({ id: job.id, time: job.time });
      }
      continue;
    }

    const startAt = zonedTimeToUtc(year, month, day, parsed.hours, parsed.minutes, tz);
    if (!DRY_RUN) {
      await prisma.job.update({
        where: { id: job.id },
        data: { startAt, timeTbd: false },
      });
    }
    updated++;
  }

  console.log(`Would update / updated: ${updated}`);
  console.log(`No-time rows (midnight + timeTbd): ${skippedNoTime}`);
  console.log(`Unparseable rows (SKIPPED, needs manual review): ${unparseable.length}`);
  for (const u of unparseable) {
    console.log(`  UNPARSEABLE job ${u.id}: time=${JSON.stringify(u.time)}`);
  }

  if (DRY_RUN) console.log('Dry run complete — no writes made.');
  else console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error('backfill-startat failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
