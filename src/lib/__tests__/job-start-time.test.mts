/**
 * Regression test (R15): starting a job records the actual start time.
 *
 * Voice mode "Start job" used to only flip the status to IN PROGRESS, so
 * the Done log rendered a bare "-" and the job card showed no start time.
 * updateJobStatus must now stamp Job.startedAt whenever a job transitions
 * into IN PROGRESS (and only then), and return it so the caller can show it.
 *
 * The real action runs against an in-memory stub (job-start-time-stub.mjs)
 * wired by job-start-time-stub-loader.mjs, registered below — only this
 * file's subprocess is affected, no database is ever contacted.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *   src/lib/__tests__/job-start-time.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./job-start-time-stub-loader.mjs', import.meta.url);

const { updateJobStatus } = await import('../../app/actions/jobs.ts');
const { db } = await import('./job-start-time-stub.mjs');

test('start stamps startedAt and returns it', async () => {
  db.reset();
  db.fixture.status = 'SCHEDULED';
  const before = Date.now();
  const res = await updateJobStatus('job-1', 'IN PROGRESS');
  const after = Date.now();
  assert.equal(res.error, undefined);
  assert.equal(res.ok, true);
  assert.equal(db.updates.length, 1);
  const data = db.updates[0].data;
  assert.equal(data.status, 'IN PROGRESS');
  assert.ok(data.startedAt instanceof Date, 'startedAt must be stamped');
  assert.ok(data.startedAt.getTime() >= before && data.startedAt.getTime() <= after);
  assert.ok(res.startedAt, 'result must carry startedAt for the caller');
  assert.equal(new Date(res.startedAt).getTime(), data.startedAt.getTime());
});

test('complete does not touch startedAt', async () => {
  db.reset();
  db.fixture.status = 'IN PROGRESS';
  db.fixture.startedAt = new Date('2026-11-17T14:00:00.000Z');
  const res = await updateJobStatus('job-1', 'COMPLETED');
  assert.equal(res.error, undefined);
  assert.equal(res.ok, true);
  assert.equal(db.updates.length, 1);
  assert.equal(db.updates[0].data.status, 'COMPLETED');
  assert.ok(!('startedAt' in db.updates[0].data), 'complete must not re-stamp');
  assert.equal(db.updates[0].data.startedAt, undefined);
  assert.equal(res.startedAt, undefined);
});

test('step back to SCHEDULED does not touch startedAt', async () => {
  db.reset();
  db.fixture.status = 'IN PROGRESS';
  db.fixture.startedAt = new Date('2026-11-17T14:00:00.000Z');
  const res = await updateJobStatus('job-1', 'SCHEDULED');
  assert.equal(res.error, undefined);
  assert.equal(db.updates.length, 1);
  assert.ok(!('startedAt' in db.updates[0].data), 'step back must not re-stamp');
});

test('re-start after a step back re-stamps with the new time', async () => {
  db.reset();
  db.fixture.status = 'SCHEDULED';
  db.fixture.startedAt = new Date('2026-11-17T14:00:00.000Z');
  const res = await updateJobStatus('job-1', 'IN PROGRESS');
  assert.equal(res.error, undefined);
  assert.ok(db.updates[0].data.startedAt instanceof Date);
  assert.ok(db.updates[0].data.startedAt.getTime() > new Date('2026-11-17T14:00:00.000Z').getTime());
});

test('invalid transition writes nothing', async () => {
  db.reset();
  // PAID -> SCHEDULED is genuinely invalid (PAID may only step back to
  // COMPLETED, and never forward again): the action must return an error
  // before any write. (2026-11-17: this test previously used NEW -> PAID,
  // which is a VALID forward transition — it only passed because the old
  // dynamic import('./invoices') threw before the write; the settle
  // helper now lives in lib and imports cleanly, so the test must use a
  // truly invalid transition.)
  db.fixture.status = 'PAID';
  const res = await updateJobStatus('job-1', 'SCHEDULED');
  assert.ok(res.error, 'expected an error for PAID -> SCHEDULED');
  assert.equal(db.updates.length, 0);
});
