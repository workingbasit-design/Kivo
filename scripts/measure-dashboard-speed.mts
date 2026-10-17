/**
 * Part D (dashboard rebuild): measures server time for the 7 dashboard
 * fetchers run in parallel against the demo business (demo-biz).
 * Target: < 300 ms total server time.
 *
 * Usage: DATABASE_URL=... node --import ./src/lib/__tests__/register-loader.mjs scripts/measure-dashboard-speed.mts
 */
import {
  getHeaderSummary,
  getCollected,
  getNeedsYou,
  getKeyNumbers,
  getTodaysVisits,
  getMoneyPipeline,
  getLast8Weeks,
} from '../src/lib/dashboard-sections.ts';

const BUSINESS_ID = 'demo-biz';
const TIMEZONE = 'America/Toronto';

async function timed<T>(name: string, fn: () => Promise<T>): Promise<{ name: string; ms: number }> {
  const start = performance.now();
  await fn();
  const ms = performance.now() - start;
  console.log(`  ${name}: ${ms.toFixed(1)} ms`);
  return { name, ms };
}

async function main() {
  console.log('Dashboard fetcher timings (demo-biz, parallel):');
  // Warm the connection pool first so we measure steady-state server time.
  await getHeaderSummary(BUSINESS_ID, { timezone: TIMEZONE });
  console.log('  (connection warmed)');
  const start = performance.now();
  const results = await Promise.all([
    timed('getHeaderSummary', () => getHeaderSummary(BUSINESS_ID, { timezone: TIMEZONE })),
    timed('getCollected', () => getCollected(BUSINESS_ID, { timezone: TIMEZONE })),
    timed('getNeedsYou', () => getNeedsYou(BUSINESS_ID)),
    timed('getKeyNumbers', () => getKeyNumbers(BUSINESS_ID, { timezone: TIMEZONE })),
    timed('getTodaysVisits', () => getTodaysVisits(BUSINESS_ID, { timezone: TIMEZONE })),
    timed('getMoneyPipeline', () => getMoneyPipeline(BUSINESS_ID)),
    timed('getLast8Weeks', () => getLast8Weeks(BUSINESS_ID, { timezone: TIMEZONE })),
  ]);
  const total = performance.now() - start;
  const slowest = Math.max(...results.map((r) => r.ms));
  console.log(`\nWall-clock parallel total: ${total.toFixed(1)} ms`);
  console.log(`Slowest single fetcher: ${slowest.toFixed(1)} ms`);
  console.log(total < 300 ? 'PASS: under 300 ms' : 'FAIL: over 300 ms');
  process.exit(total < 300 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
