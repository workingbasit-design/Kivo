/**
 * Restore drill: take a real pg_dump -Fc backup file (produced by
 * scripts/backup-db.sh), restore it with pg_restore into a FRESH
 * database, and verify every table's row count matches the source.
 *
 * This is the D5 Stage 3 acceptance test: a backup does not count until
 * a restore of the actual artifact succeeds.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54333/kivo_scratch" \
 *     node --experimental-strip-types scripts/restore-drill.ts \
 *     /var/backups/everyjob/everyjob-2026-11-17.dump
 *
 * Scratch-local ONLY. Refuses to run unless DATABASE_URL is the local
 * scratch Postgres (127.0.0.1:54333). Never touches production.
 *
 * Steps: (1) read per-table counts from the source DB, (2) DROP/CREATE
 * DATABASE kivo_restore_drill, (3) pg_restore the dump into it,
 * (4) compare every table count, (5) data-driven spot checks: one
 * business's customers/jobs/invoices, and one invoice's total vs its
 * payments, must be identical in source and restored DBs.
 *
 * History: the 2026-10-14 version extracted rows via Prisma and
 * hard-coded the perf seed (perf-biz, 10000 jobs). This rewrite restores
 * the real backup artifact instead, so the drill tests what the nightly
 * cron actually produces.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const SRC = process.env.DATABASE_URL ?? '';
if (!SRC.includes('127.0.0.1:54333') && !SRC.includes('localhost:54333')) {
  console.error('REFUSED: restore drill only runs against the local scratch DB.');
  process.exit(1);
}
const DUMP = process.argv[2] ?? '';
if (!DUMP || !existsSync(DUMP)) {
  console.error('Usage: restore-drill.ts <dump-file>  (dump from scripts/backup-db.sh)');
  process.exit(1);
}
const DST = SRC.replace(/\/[^/]*$/, '/kivo_restore_drill');
const t0 = Date.now();
const log = (m: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

function pgRestore(args: string[]): void {
  try {
    execFileSync('pg_restore', args, { stdio: 'pipe' });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message?: string };
    console.error('pg_restore failed:', (err.stderr?.toString() ?? err.message ?? '').slice(-2000));
    throw new Error('pg_restore failed');
  }
}

async function tableCounts(db: PrismaClient): Promise<Map<string, number>> {
  const tables = (await db.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  )) as Array<{ table_name: string }>;
  const counts = new Map<string, number>();
  for (const { table_name } of tables) {
    const n = (await db.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "${table_name}"`,
    )) as Array<{ n: number }>;
    counts.set(table_name, n[0].n);
  }
  return counts;
}

async function main() {
  const src = new PrismaClient({ datasources: { db: { url: SRC } } });
  const admin = new PrismaClient({ datasources: { db: { url: SRC.replace(/\/[^/]*$/, '/postgres') } } });

  // ---- 1. Source counts ----
  const expected = await tableCounts(src);
  const totalRows = [...expected.values()].reduce((n, c) => n + c, 0);
  log(`source: ${expected.size} tables, ${totalRows} rows`);

  // ---- 2. Fresh database ----
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "kivo_restore_drill"`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "kivo_restore_drill"`);
  log('created database kivo_restore_drill');

  // ---- 3. Restore the real artifact ----
  pgRestore(['--dbname', DST, '--no-owner', DUMP]);
  log(`pg_restore done: ${DUMP}`);

  // ---- 4. Compare counts ----
  const dst = new PrismaClient({ datasources: { db: { url: DST } } });
  const actual = await tableCounts(dst);
  let mismatches = 0;
  for (const [table, want] of expected) {
    const got = actual.get(table);
    if (got !== want) {
      console.log(`MISMATCH ${table}: expected ${want}, got ${got}`);
      mismatches++;
    }
  }
  for (const table of actual.keys()) {
    if (!expected.has(table)) {
      console.log(`MISMATCH ${table}: unexpected table in restored DB`);
      mismatches++;
    }
  }
  log(`verify: ${mismatches} mismatches across ${expected.size} tables`);

  // ---- 5. Data-driven spot checks (no hardcoded seed ids) ----
  const biz = (await src.$queryRawUnsafe(
    `SELECT id FROM "Business" ORDER BY "createdAt" LIMIT 1`,
  )) as Array<{ id: string }>;
  if (biz.length === 0) throw new Error('VERIFY FAILED: source has no business to spot-check');
  const bizId = biz[0].id;
  for (const [table, where] of [
    ['Customer', `"businessId"='${bizId}'`],
    ['Job', `"businessId"='${bizId}'`],
    ['Invoice', `"businessId"='${bizId}'`],
  ] as const) {
    const s = (await src.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
    )) as Array<{ n: number }>;
    const d = (await dst.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
    )) as Array<{ n: number }>;
    if (s[0].n !== d[0].n) throw new Error(`VERIFY FAILED: ${table} for first business ${s[0].n} != ${d[0].n}`);
    log(`spot-check ${table} (first business): ${s[0].n} rows match`);
  }
  const inv = (await src.$queryRawUnsafe(
    `SELECT id, "totalCents" FROM "Invoice" ORDER BY "createdAt" LIMIT 1`,
  )) as Array<{ id: string; totalCents: bigint }>;
  if (inv.length > 0) {
    const paid = async (db: PrismaClient) =>
      (await db.$queryRawUnsafe(
        `SELECT coalesce(sum("amountCents"),0)::bigint AS s FROM "Payment" WHERE "invoiceId"='${inv[0].id}' AND status='COMPLETED'`,
      )) as Array<{ s: bigint }>;
    const sPaid = (await paid(src))[0].s;
    const dPaid = (await paid(dst))[0].s;
    const dTotal = (await dst.$queryRawUnsafe(
      `SELECT "totalCents" FROM "Invoice" WHERE id='${inv[0].id}'`,
    )) as Array<{ totalCents: bigint }>;
    if (dTotal.length !== 1 || dTotal[0].totalCents !== inv[0].totalCents || sPaid !== dPaid) {
      throw new Error('VERIFY FAILED: first invoice total/payments differ after restore');
    }
    log(`spot-check invoice ${inv[0].id}: totalCents=${inv[0].totalCents}, completed payments=${sPaid} match`);
  }

  await src.$disconnect();
  await dst.$disconnect();
  await admin.$disconnect();
  if (mismatches > 0) throw new Error('VERIFY FAILED');
  log(`DRILL PASSED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error('DRILL FAILED:', e.message ?? e);
  process.exit(1);
});
