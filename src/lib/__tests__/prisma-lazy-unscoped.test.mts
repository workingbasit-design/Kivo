import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SRC = join(TEST_DIR, '..', '..', '..');

// P1.0 D1: the unguarded client must be LAZY. Importing the real prisma
// module must NOT create a second PrismaClient (the old code created both
// clients eagerly, so every serverless instance opened 2 connections at
// cold start even if it never served a token page).
test('D1: importing prisma.ts does not create the unscoped client', async () => {
  const { getPrismaUnscoped } = await import('../prisma.ts');
  assert.equal(typeof getPrismaUnscoped, 'function', 'getPrismaUnscoped exists');
  assert.equal(
    'prismaUnscoped' in globalThis,
    false,
    'no unscoped client on globalThis after import',
  );
  const first = getPrismaUnscoped();
  assert.ok(first, 'getPrismaUnscoped returns a client');
  assert.equal('prismaUnscoped' in globalThis, true, 'created on first use');
  assert.equal(
    getPrismaUnscoped(),
    first,
    'second call returns the same cached client',
  );
});

test('D1: no eager prismaUnscoped export; guard fallback uses the lazy getter', () => {
  const prismaSrc = readFileSync(join(SRC, 'src', 'lib', 'prisma.ts'), 'utf8');
  assert.ok(
    !/export const prismaUnscoped/.test(prismaSrc),
    'prisma.ts must not export an eager prismaUnscoped',
  );
  assert.ok(
    /export function getPrismaUnscoped/.test(prismaSrc),
    'prisma.ts exports getPrismaUnscoped',
  );
  const guardSrc = readFileSync(join(SRC, 'src', 'lib', 'tenant-guard.ts'), 'utf8');
  assert.ok(
    guardSrc.includes('getPrismaUnscoped'),
    'tenant-guard fallback creates the client via getPrismaUnscoped',
  );
  // No production file may reference the old eager export.
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  const prodFiles = walk(join(SRC, 'src')).filter(
    (p) => /\.(ts|tsx)$/.test(p) && !p.includes('__tests__'),
  );
  for (const p of prodFiles) {
    const src = readFileSync(p, 'utf8');
    // prisma.ts itself holds the globalThis cache key + getter; it is
    // covered by the dedicated assertions above.
    if (!p.endsWith(join('lib', 'prisma.ts'))) {
      assert.ok(
        !src.includes('prismaUnscoped'),
        `${p} must not reference prismaUnscoped`,
      );
    }
    assert.ok(
      !src.includes("from '@/lib/rate-limit'") || src.includes("from '@/lib/rate-limit-durable'"),
      `${p} must not import the deleted in-memory limiter`,
    );
  }
  assert.equal(
    existsSync(join(SRC, 'src', 'lib', 'rate-limit.ts')),
    false,
    'src/lib/rate-limit.ts is deleted (S4 cleanup)',
  );
});

test('D1: job-queries helpers are defensively capped', () => {
  const src = readFileSync(join(SRC, 'src', 'lib', 'job-queries.ts'), 'utf8');
  assert.ok(src.includes('LIST_MAX_SIZE'), 'job-queries imports the cap');
  const inRange = src.slice(src.indexOf('export async function getJobsInRange'));
  assert.ok(inRange.includes('take: LIST_MAX_SIZE'), 'getJobsInRange is capped');
  const getJobs = src.slice(src.indexOf('export async function getJobs('));
  assert.ok(getJobs.includes('take: LIST_MAX_SIZE'), 'getJobs is capped');
});
