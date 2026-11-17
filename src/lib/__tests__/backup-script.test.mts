/**
 * P1.0 F3 — backup script safety guards (no live DB needed).
 *
 * scripts/backup-db.sh must refuse to run without DATABASE_URL, and must
 * refuse an unwritable BACKUP_DIR, before it ever touches pg_dump.
 * The full dump -> verify -> restore loop is covered by
 * backup-restore.test.db.mts (needs a real Postgres) and by the manual
 * restore drill (scripts/restore-drill.ts).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../../../scripts/backup-db.sh', import.meta.url).pathname;

function run(env: Record<string, string | undefined>) {
  return spawnSync(SCRIPT, [], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('P1.0 F3: backup-db.sh guards', () => {
  it('refuses to run without DATABASE_URL', () => {
    const r = run({ DATABASE_URL: undefined, BACKUP_DIR: mkdtempSync(join(tmpdir(), 'bk-')) });
    assert.notEqual(r.status, 0, 'must exit non-zero');
    assert.match(r.stderr, /DATABASE_URL must be set/);
  });

  it('refuses an unwritable BACKUP_DIR before contacting the database', () => {
    const r = run({
      DATABASE_URL: 'postgresql://127.0.0.1:1/nope',
      BACKUP_DIR: '/proc/definitely-not-a-backup-dir',
    });
    assert.notEqual(r.status, 0, 'must exit non-zero');
    assert.match(r.stderr, /BACKUP_DIR/);
  });

  it('fails (does not claim success) when pg_dump cannot connect', () => {
    const which = spawnSync('command', ['-v', 'pg_dump'], { encoding: 'utf8', shell: true });
    if (!which.stdout.trim()) {
      // No pg_dump in this environment: nothing to connect with.
      return;
    }
    const r = run({
      DATABASE_URL: 'postgresql://127.0.0.1:1/nope',
      BACKUP_DIR: mkdtempSync(join(tmpdir(), 'bk-')),
    });
    assert.notEqual(r.status, 0, 'must exit non-zero');
    assert.doesNotMatch(r.stdout, /BACKUP OK/);
  });
});
