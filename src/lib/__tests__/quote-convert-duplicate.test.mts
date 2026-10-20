/**
 * Regression tests for the 2026-10-19 morning QA bug: "Convert to job"
 * stayed available on an ALREADY-CONVERTED approved quote (the quote keeps
 * APPROVED status after conversion), so a second click silently created a
 * duplicate job — Q-0001 produced two jobs on production before cleanup.
 *
 * The fix guards convertQuoteToJob with the canonical notes marker from
 * convertedJobDetails ("Converted from quote <number>."); quote numbers
 * are unique per business, so a marker hit means "already converted".
 * The quote detail page additionally hides the convert button when the
 * marker job exists and links to it instead.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/quote-convert-duplicate.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./register-loader.mjs', import.meta.url);
register('./quote-convert-duplicate-stub-loader.mjs', import.meta.url);

const { convertQuoteToJob } = await import('@/app/actions/quotes.ts');
const { convertedJobNotesPrefix } = await import('@/lib/quotes.ts');
const stub = await import('./quote-convert-duplicate-stub.mjs');

function formData() {
  const fd = new FormData();
  fd.append('id', 'quote_1');
  return fd;
}

test('convertedJobNotesPrefix is the canonical marker used by convertedJobDetails', () => {
  // Source guard: if convertedJobDetails ever stops stamping the shared
  // prefix, the duplicate-conversion guard silently stops matching.
  const src = readFileSync(
    new URL('../quotes.ts', import.meta.url),
    'utf8'
  );
  const body = src.slice(src.indexOf('export function convertedJobDetails'));
  assert.ok(
    body.includes('convertedJobNotesPrefix(quoteNumber)'),
    'convertedJobDetails must stamp convertedJobNotesPrefix(quoteNumber)'
  );
  assert.equal(convertedJobNotesPrefix('Q-0001'), 'Converted from quote Q-0001.');
});

test('first conversion of an approved quote creates exactly one job and redirects to it', async () => {
  stub.resetQuoteConvertStub();
  stub.setJobFindFirstResult(null); // not converted yet

  let redirected = null;
  try {
    await convertQuoteToJob({}, formData());
  } catch (e) {
    redirected = e;
  }

  assert.equal(stub.createCalls.length, 1, 'job.create must run once');
  const data = stub.createCalls[0].data;
  assert.equal(data.businessId, 'biz_1');
  assert.ok(
    data.notes.startsWith('Converted from quote Q-0001.'),
    `job notes must carry the canonical marker, got: ${data.notes}`
  );
  assert.equal(redirected?.digest, 'NEXT_REDIRECT');
  assert.equal(redirected?.url, '/jobs/job_new');

  // The marker lookup itself must be tenant- and quote-number-scoped.
  assert.equal(stub.jobFindFirstCalls.length, 1);
  assert.deepEqual(stub.jobFindFirstCalls[0].where, {
    businessId: 'biz_1',
    notes: { startsWith: 'Converted from quote Q-0001.' },
  });
});

test('second conversion attempt is refused and creates no job', async () => {
  stub.resetQuoteConvertStub();
  stub.setJobFindFirstResult({ id: 'job_existing' }); // already converted

  const res = await convertQuoteToJob({}, formData());

  assert.match(res.error ?? '', /already been converted/);
  assert.equal(res.id, 'job_existing', 'returns the existing job id for linking');
  assert.equal(
    stub.createCalls.length,
    0,
    'job.create must NOT run on a duplicate conversion attempt'
  );
});
