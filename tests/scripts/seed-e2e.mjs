#!/usr/bin/env node
/**
 * Prompt 4 E2E seed wrapper.
 *
 * 1. Runs scripts/seed-staging.ts (two businesses, roles, consumers — idempotent,
 *    refuses production unless SEED_ALLOW_PROD=true).
 * 2. Applies E2E-specific relative-date fixups so time-dependent assertions are
 *    deterministic without app clock-mocking:
 *      - seed-job-on-late: startAt = yesterday 09:00 (Late badge)
 *      - seed-inv-on-overdue: dueAt = yesterday (Overdue status)
 *      - seed-quote-on-expiring: validUntil = tomorrow (expiry test flips it)
 * 3. Prints known totals for Money/Dashboard reconciliation assertions.
 *
 * Usage: DATABASE_URL=<test-db> node tests/scripts/seed-e2e.mjs
 */
import { spawnSync } from 'node:child_process';

const dbUrl = process.env.DATABASE_URL ?? '';
if (!dbUrl) {
  console.error('REFUSED: DATABASE_URL is not set. E2E seeding needs an isolated test database.');
  process.exit(1);
}
const host = (() => {
  try {
    return new URL(dbUrl).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1'].includes(host) && !host.includes('staging') && !host.includes('test')) {
  console.error(`REFUSED: host "${host}" does not look like a test database.`);
  process.exit(1);
}

console.log('Step 1/2: base seed (seed-staging.ts)…');
const seed = spawnSync('node', ['--experimental-strip-types', 'scripts/seed-staging.ts'], {
  stdio: 'inherit',
  env: process.env,
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

console.log('Step 2/2: relative-date fixups…');
const fixup = spawnSync('node', ['--experimental-strip-types', 'tests/scripts/e2e-fixups.mts'], {
  stdio: 'inherit',
  env: process.env,
});
if (fixup.status !== 0) process.exit(fixup.status ?? 1);

console.log('E2E seed complete.');
