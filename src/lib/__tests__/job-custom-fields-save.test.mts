/**
 * Regression test (R16): the job form's main Save must persist custom-field
 * values — not just the per-field green checkmark.
 *
 * The custom-field editor lives outside the job <form>, so its values used
 * to never reach the submission: typing a value and tapping the main Save
 * silently dropped it, and the empty input showed its "-" placeholder on
 * reopen. The editor's value inputs now associate with the form
 * (form="job-form", name="customField_<fieldId>") and updateJob persists
 * every customField_* entry after the job update, before redirecting.
 *
 * The real action runs against an in-memory stub
 * (job-custom-fields-stub.mjs) wired by job-custom-fields-stub-loader.mjs,
 * registered below — only this file's subprocess is affected, no database
 * is ever contacted. updateJob ends in redirect(), which the stub throws,
 * so the tests assert the writes happened before that throw.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *   src/lib/__tests__/job-custom-fields-save.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./job-custom-fields-stub-loader.mjs', import.meta.url);

const { updateJob } = await import('../../app/actions/jobs.ts');
const { listJobFieldDefs } = await import('../../app/actions/custom-fields.ts');
const { db } = await import('./job-custom-fields-stub.mjs');

function jobForm(extra = {}) {
  const fd = new FormData();
  fd.set('id', 'job-1');
  fd.set('title', 'QATEST Job');
  fd.set('customerId', 'cust-1');
  fd.set('date', '2026-11-17');
  fd.set('time', '10:00 AM');
  fd.set('price', '100');
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

/** updateJob redirects on success — the stub throws; the writes land first. */
async function saveExpectRedirect(fd) {
  let threw = null;
  try {
    await updateJob({}, fd);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, 'updateJob should redirect on success');
  assert.match(threw.message, /redirect\(\) called in test/);
}

test('main Save persists a custom-field value (no checkmark tap)', async () => {
  db.reset();
  await saveExpectRedirect(jobForm({ 'customField_field-1': 'ABC123' }));
  assert.equal(db.jobUpdates.length, 1, 'the job itself must be saved');
  assert.equal(db.upserts.length, 1, 'one custom-field write expected');
  assert.deepEqual(db.upserts[0], { fieldId: 'field-1', jobId: 'job-1', value: 'ABC123' });
  // Reopen: the value reads back.
  const reopened = await listJobFieldDefs('job-1');
  assert.equal(reopened.ok, true);
  assert.deepEqual(reopened.values, [{ fieldId: 'field-1', value: 'ABC123' }]);
});

test('main Save with an empty value clears the field', async () => {
  db.reset();
  db.fieldValues.push({ fieldId: 'field-1', jobId: 'job-1', value: 'OLD' });
  await saveExpectRedirect(jobForm({ 'customField_field-1': '' }));
  assert.equal(db.upserts.length, 0, 'empty must not upsert');
  assert.equal(db.deletes.length, 1, 'empty must delete the stored value');
  assert.deepEqual(db.fieldValues, [], 'the stored value must be gone');
  const reopened = await listJobFieldDefs('job-1');
  assert.deepEqual(reopened.values, []);
});

test('main Save with no custom-field entries leaves values untouched', async () => {
  db.reset();
  db.fieldValues.push({ fieldId: 'field-1', jobId: 'job-1', value: 'KEPT' });
  await saveExpectRedirect(jobForm());
  assert.equal(db.upserts.length, 0);
  assert.equal(db.deletes.length, 0);
  assert.deepEqual(db.fieldValues, [{ fieldId: 'field-1', jobId: 'job-1', value: 'KEPT' }]);
});

test('a failed custom-field write surfaces an error instead of redirecting', async () => {
  db.reset();
  // Unknown field id: setJobFieldValue returns notFound.
  const res = await updateJob({}, jobForm({ 'customField_no_such_field': 'X' }));
  assert.equal(res.error, 'Could not save custom fields. Please try again.');
  assert.equal(db.jobUpdates.length, 1, 'the job update itself still ran');
  assert.equal(db.upserts.length, 0, 'no value was written for the unknown field');
});
