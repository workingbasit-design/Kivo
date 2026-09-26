#!/usr/bin/env node
/**
 * One-time backfill: mark pre-moat reviews as "Legacy".
 *
 * Before the verified-review moat (2026-09-26), reviews could be created by
 * anyone through the public /r/[businessId] form or by the pro without a
 * job link. This script marks every review whose source is neither
 * 'Verified' (token-linked or job-linked, post-moat) nor 'Google' as
 * 'Legacy', so the UI can distinguish them honestly.
 *
 * SAFE TO RE-RUN: only touches rows whose source is not already
 * Verified/Google/Legacy.
 *
 * Usage: DATABASE_URL="..." node scripts/backfill-review-sources.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.review.updateMany({
    where: {
      NOT: { source: { in: ['Verified', 'Google', 'Legacy'] } },
    },
    data: { source: 'Legacy' },
  });
  console.log(`Marked ${result.count} review(s) as Legacy.`);
}

try {
  await main();
} catch (err) {
  console.error('Backfill failed:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
