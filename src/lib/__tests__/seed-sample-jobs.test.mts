/**
 * Regression test (Decision 6): sample-data generation must never run in a
 * real production business.
 *
 * seedSampleJobs() used to write unmarked fake data (Martin Roy + 3 jobs)
 * into any zero-job business from the Schedule empty state. It is now
 * gated server-side: only demo businesses (isDemo — labelled "Demo"
 * everywhere) or non-production environments may seed. The Schedule page
 * hides the button for everyone else; this test proves the server action
 * itself refuses, so a forged call cannot write fake data either.
 *
 * The real action runs against an in-memory stub
 * (seed-sample-jobs-stub.mjs) wired by seed-sample-jobs-stub-loader.mjs,
 * registered below — only this file's subprocess is affected, no database
 * is ever contacted. Each case sets process.env.NODE_ENV explicitly,
 * because the gate reads it at call time.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *   src/lib/__tests__/seed-sample-jobs.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./seed-sample-jobs-stub-loader.mjs', import.meta.url);

const { seedSampleJobs } = await import('../../app/actions/jobs.ts');
const { db } = await import('./seed-sample-jobs-stub.mjs');

const PREV_NODE_ENV = process.env.NODE_ENV;

function asEnv(nodeEnv, fn) {
  return async () => {
    process.env.NODE_ENV = nodeEnv;
    try {
      await fn();
    } finally {
      process.env.NODE_ENV = PREV_NODE_ENV;
    }
  };
}

test(
  'production + real business + zero jobs: blocked, nothing written',
  asEnv('production', async () => {
    db.reset();
    db.demo = false;
    db.jobCount = 0;
    const res = await seedSampleJobs();
    assert.equal(res.error, 'Sample jobs are only available for demo businesses.');
    assert.equal(res.ok, undefined);
    assert.deepEqual(db.customers, [], 'no fake customer must be created');
    assert.deepEqual(db.jobs, [], 'no fake jobs must be created');
  })
);

test(
  'production + demo business + zero jobs: allowed, seeds Martin Roy + 3 jobs',
  asEnv('production', async () => {
    db.reset();
    db.demo = true;
    db.jobCount = 0;
    const res = await seedSampleJobs();
    assert.equal(res.error, undefined);
    assert.equal(res.ok, true);
    assert.equal(db.customers.length, 1);
    assert.equal(db.customers[0].name, 'Martin Roy');
    assert.equal(db.jobs.length, 3);
    assert.deepEqual(
      db.jobs.map((j) => j.title),
      ['Furnace and AC tune-up', 'Bathroom faucet leak repair', 'Full home deep cleaning']
    );
    assert.ok(db.jobs.every((j) => j.businessId === 'biz-1' && j.status === 'SCHEDULED'));
  })
);

test(
  'production + real business + existing jobs: blocked before the count check',
  asEnv('production', async () => {
    db.reset();
    db.demo = false;
    db.jobCount = 5;
    const res = await seedSampleJobs();
    assert.equal(res.error, 'Sample jobs are only available for demo businesses.');
    assert.deepEqual(db.customers, []);
    assert.deepEqual(db.jobs, []);
  })
);

test(
  'development + real business + zero jobs: allowed (dev carve-out)',
  asEnv('development', async () => {
    db.reset();
    db.demo = false;
    db.jobCount = 0;
    const res = await seedSampleJobs();
    assert.equal(res.error, undefined);
    assert.equal(res.ok, true);
    assert.equal(db.jobs.length, 3);
  })
);
