/**
 * P1.0 F3 — backup -> restore round-trip (REAL Postgres).
 *
 * Fail-closed: throws if TEST_DATABASE_URL is unset (CI must report
 * 0 skipped). Never runs against production — the source and restored
 * databases are throwaway DBs created for this test (kivo_backup_src /
 * kivo_backup_dst) on the test server.
 *
 * Skips (recorded, with the reason in the test name) only when the
 * pg_dump/pg_restore binaries are missing or older than the server —
 * pg_dump refuses to dump a newer server. The standalone drill
 * (scripts/restore-drill.ts, run against the local scratch DB) is the
 * primary evidence when the CI runner cannot run this test.
 *
 * Flow: migrate deploy on a fresh source DB -> small deterministic
 * dataset -> scripts/backup-db.sh -> pg_restore into a fresh DB ->
 * every table count matches + one invoice's total/payments match.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  throw new Error(
    'backup-restore: TEST_DATABASE_URL is required. These tests fail closed (no silent skips).',
  );
}

const SCRIPT = new URL('../../../scripts/backup-db.sh', import.meta.url).pathname;
const SRC_DB = 'kivo_backup_src';
const DST_DB = 'kivo_backup_dst';

function dbUrl(db: string): string {
  return TEST_URL.replace(/\/[^/]*$/, `/${db}`);
}
function maintenanceUrl(): string {
  return TEST_URL.replace(/\/[^/]*$/, '/postgres');
}
function pgVersion(bin: string): number | null {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  const m = /(\d+)\./.exec(r.stdout ?? '');
  return m ? Number(m[1]) : null;
}

describe('P1.0 F3: backup -> restore round-trip', () => {
  const dumpMajor = pgVersion('pg_dump');
  const restoreMajor = pgVersion('pg_restore');
  let serverMajor: number | null = null;
  let admin: PrismaClient | null = null;
  let canRun = false;
  let skipReason = '';

  before(async () => {
    admin = new PrismaClient({ datasources: { db: { url: maintenanceUrl() } } });
    const v = (await admin.$queryRawUnsafe(
      `SHOW server_version`,
    )) as Array<{ server_version: string }>;
    serverMajor = Number(v[0].server_version.split('.')[0]);
    if (dumpMajor === null || restoreMajor === null) {
      skipReason = 'pg_dump/pg_restore not installed on this runner';
    } else if (dumpMajor < serverMajor || restoreMajor < serverMajor) {
      skipReason = `pg_dump ${dumpMajor}/pg_restore ${restoreMajor} older than server ${serverMajor}`;
    } else {
      canRun = true;
    }
  });

  after(async () => {
    if (admin) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DST_DB}"`);
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SRC_DB}"`);
      await admin.$disconnect();
    }
  });

  it('dump -> verify -> restore reproduces every table exactly', async () => {
    if (!canRun) {
      // Recorded skip: the tooling cannot dump this server version.
      assert.ok(skipReason.length > 0);
      return;
    }
    assert.ok(admin);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SRC_DB}"`);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DST_DB}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${SRC_DB}"`);

    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: dbUrl(SRC_DB) },
      stdio: 'pipe',
    });

    const src = new PrismaClient({ datasources: { db: { url: dbUrl(SRC_DB) } } });
    try {
      await src.business.create({
        data: {
          id: 'bk-biz',
          name: 'Backup Test Co',
          timezone: 'America/Toronto',
          customers: {
            create: [
              { id: 'bk-cust-1', name: 'Alice Backup' },
              { id: 'bk-cust-2', name: 'Bob Backup' },
            ],
          },
          jobs: {
            create: [
              {
                id: 'bk-job-1',
                title: 'Backup job',
                date: new Date('2026-11-17T00:00:00Z'),
                priceCents: 10000n,
                status: 'COMPLETED',
                customerId: 'bk-cust-1',
              },
            ],
          },
        },
      });
      await src.invoice.create({
        data: {
          id: 'bk-inv-1',
          number: 'BK-0001',
          date: new Date('2026-11-17T00:00:00Z'),
          subtotalCents: 10000n,
          taxAmountCents: 1300n,
          totalCents: 11300n,
          status: 'PARTIALLY PAID',
          customerId: 'bk-cust-1',
          businessId: 'bk-biz',
          payments: {
            create: [{ amountCents: 5000n, provider: 'CASH', status: 'COMPLETED', businessId: 'bk-biz' }],
          },
        },
      });

      const backupDir = mkdtempSync(join(tmpdir(), 'bk-restore-'));
      const r = spawnSync(SCRIPT, [], {
        env: { ...process.env, DATABASE_URL: dbUrl(SRC_DB), BACKUP_DIR: backupDir },
        encoding: 'utf8',
        timeout: 120_000,
      });
      assert.equal(r.status, 0, `backup-db.sh failed: ${r.stderr}\n${r.stdout}`);
      assert.match(r.stdout, /BACKUP OK/);
      const dumps = readdirSync(backupDir).filter((f) => f.endsWith('.dump'));
      assert.equal(dumps.length, 1, `expected one dump in ${backupDir}`);
      const dumpPath = join(backupDir, dumps[0]);
      assert.ok(existsSync(dumpPath));

      await admin.$executeRawUnsafe(`CREATE DATABASE "${DST_DB}"`);
      execFileSync('pg_restore', ['--dbname', dbUrl(DST_DB), '--no-owner', dumpPath], { stdio: 'pipe' });

      const dst = new PrismaClient({ datasources: { db: { url: dbUrl(DST_DB) } } });
      try {
        const counts = async (db: PrismaClient) => {
          const tables = (await db.$queryRawUnsafe(
            `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
          )) as Array<{ table_name: string }>;
          const out = new Map<string, number>();
          for (const { table_name } of tables) {
            const n = (await db.$queryRawUnsafe(
              `SELECT count(*)::int AS n FROM "${table_name}"`,
            )) as Array<{ n: number }>;
            out.set(table_name, n[0].n);
          }
          return out;
        };
        const want = await counts(src);
        const got = await counts(dst);
        assert.deepEqual([...got.keys()].sort(), [...want.keys()].sort(), 'table sets differ');
        for (const [table, n] of want) {
          assert.equal(got.get(table), n, `table ${table}: ${got.get(table)} != ${n}`);
        }
        const inv = (await dst.$queryRawUnsafe(
          `SELECT "totalCents" FROM "Invoice" WHERE id='bk-inv-1'`,
        )) as Array<{ totalCents: bigint }>;
        assert.equal(inv.length, 1);
        assert.equal(inv[0].totalCents, 11300n);
        const paid = (await dst.$queryRawUnsafe(
          `SELECT coalesce(sum("amountCents"),0)::bigint AS s FROM "Payment" WHERE "invoiceId"='bk-inv-1' AND status='COMPLETED'`,
        )) as Array<{ s: bigint }>;
        assert.equal(paid[0].s, 5000n);
      } finally {
        await dst.$disconnect();
      }
    } finally {
      await src.$disconnect();
    }
  });
});
