/**
 * Restore drill: logical backup of the scratch DB -> restore into a FRESH
 * database -> verify. Records timings for docs/BACKUP_RESTORE.md.
 *
 * Steps: (1) extract all rows from every user table, (2) CREATE DATABASE
 * kivo_restore_drill, (3) `prisma migrate deploy` on the fresh DB (also
 * validates the hand-written migration chain applies cleanly to empty),
 * (4) bulk-load all rows with FK checks deferred, (5) verify row counts +
 * spot-check queries.
 *
 * Scratch-local ONLY. Refuses to run unless the URL is the local scratch
 * Postgres. Never touches production.
 */
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const SRC = process.env.DATABASE_URL ?? '';
if (!SRC.includes('127.0.0.1:54333') && !SRC.includes('localhost:54333')) {
  console.error('REFUSED: restore drill only runs against the local scratch DB.');
  process.exit(1);
}
const DST = SRC.replace(/\/[^/]*$/, '/kivo_restore_drill');
const t0 = Date.now();
const log = (m: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

async function main() {
  const src = new PrismaClient({ datasources: { db: { url: SRC } } });
  const admin = new PrismaClient({ datasources: { db: { url: SRC.replace(/\/[^/]*$/, '/postgres') } } });

  // ---- 1. Extract ----
  const tables = (await src.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT LIKE '\\_prisma%' ORDER BY table_name`
  )) as Array<{ table_name: string }>;
  log(`extract: ${tables.length} tables`);
  const dump = new Map<string, { cols: string[]; rows: unknown[][] }>();
  for (const { table_name } of tables) {
    const cols = (await src.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table_name}' ORDER BY ordinal_position`
    )) as Array<{ column_name: string }>;
    const colNames = cols.map((c) => c.column_name);
    const rows = (await src.$queryRawUnsafe(
      `SELECT ${colNames.map((c) => `"${c}"`).join(',')} FROM "${table_name}"`
    )) as Array<Record<string, unknown>>;
    dump.set(table_name, { cols: colNames, rows: rows.map((r) => colNames.map((c) => r[c])) });
  }
  const totalRows = [...dump.values()].reduce((n, t) => n + t.rows.length, 0);
  log(`extract done: ${totalRows} rows`);

  // ---- 2. Fresh database ----
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "kivo_restore_drill"`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "kivo_restore_drill"`);
  log('created database kivo_restore_drill');

  // ---- 3. Migrate deploy on the empty DB (validates the chain) ----
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: DST },
    stdio: 'pipe',
  });
  log('migrate deploy on fresh DB: ok');

  // ---- 4. Load (FK checks deferred, like pg_restore) ----
  const dst = new PrismaClient({ datasources: { db: { url: DST } } });
  await dst.$executeRawUnsafe(`SET session_replication_role = 'replica'`);
  for (const [table, { cols, rows }] of dump) {
    if (rows.length === 0) continue;
    const colList = cols.map((c) => `"${c}"`).join(',');
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const params: unknown[] = [];
      const tuples = batch.map((row) => {
        const ph = row.map((v) => {
          params.push(v instanceof Date ? v : v);
          return `$${params.length}`;
        });
        return `(${ph.join(',')})`;
      });
      try {
        // ON CONFLICT DO NOTHING: migrate deploy re-seeds static tables
        // (e.g. M3 TaxRate rows); the restore must not duplicate them.
        await dst.$executeRawUnsafe(
          `INSERT INTO "${table}" (${colList}) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`,
          ...params
        );
      } catch (e: unknown) {
        const err = e as { message?: unknown; code?: unknown } | null;
        console.log(`LOAD FAILED at ${table} batch ${i}:`, String(err?.message ?? e).slice(0, 300), 'code=', err?.code);
        throw e;
      }
    }
  }
  await dst.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
  log('load done');

  // ---- 5. Verify ----
  let mismatches = 0;
  for (const [table] of dump) {
    const n = (await dst.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`)) as Array<{ n: number }>;
    const expected = dump.get(table)!.rows.length;
    if (n[0].n !== expected) {
      console.log(`MISMATCH ${table}: expected ${expected}, got ${n[0].n}`);
      mismatches++;
    }
  }
  const spot = (await dst.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "Job" WHERE "businessId"='perf-biz'`
  )) as Array<{ n: number }>;
  const spot2 = (await dst.$queryRawUnsafe(
    `SELECT "number","totalCents" FROM "Invoice" WHERE "businessId"='perf-biz' AND "status"='UNPAID' ORDER BY "dueAt" LIMIT 3`
  )) as Array<{ number: string; totalCents: number }>;
  log(`verify: ${mismatches} mismatches; spot-check perf jobs=${spot[0].n}, unpaid invoices sample=${spot2.length}`);
  if (mismatches > 0 || spot[0].n !== 10000 || spot2.length === 0) throw new Error('VERIFY FAILED');

  await src.$disconnect();
  await dst.$disconnect();
  await admin.$disconnect();
  log(`DRILL PASSED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error('DRILL FAILED:', e.message ?? e);
  process.exit(1);
});
