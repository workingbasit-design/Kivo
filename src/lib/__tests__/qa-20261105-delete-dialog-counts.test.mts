/**
 * Regression tests for the 2026-11-05 exhaustive-sweep finding #2 (MAJOR).
 *
 * The archived-customer delete dialog keyed its copy ONLY on `archived`, so
 * every archived customer got the "no jobs, invoices, or quotes on file"
 * promise — then the server refused whenever voided/converted/expired
 * records existed, and the failure looked like a broken button. The dialog
 * now keys on real linked-record counts (Prisma _count, same relations the
 * deleteCustomer guard counts) and, when blocked, shows the counts and
 * disables confirm instead of promising a deletion.
 *
 * Run: npm test -- src/lib/__tests__/qa-20261105-delete-dialog-counts.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { t } = await import('../i18n/index.ts');
const { formatRecordCounts } = await import('../record-counts.ts');

for (const locale of ['en', 'fr'] as const) {
  test(`custDeleteMsgBlocked (${locale}) exists and names the customer and counts`, () => {
    const msg = t(locale, 't10money.custDeleteMsgBlocked');
    assert.notEqual(msg, 't10money.custDeleteMsgBlocked', 'key missing');
    assert.ok(msg.includes('{name}'), `missing {name}: ${msg}`);
    assert.ok(msg.includes('{counts}'), `missing {counts}: ${msg}`);
  });

  test(`custDeleteMsgBlocked (${locale}) states the 6-year retention rule`, () => {
    const msg = t(locale, 't10money.custDeleteMsgBlocked');
    assert.match(msg, locale === 'en' ? /6 years/ : /6 ans/);
  });

  test(`custDeleteMsgBlocked (${locale}) never promises "no records"`, () => {
    const msg = t(locale, 't10money.custDeleteMsgBlocked');
    assert.ok(!/no jobs, invoices, or quotes on file/i.test(msg), `EN stale promise: ${msg}`);
    assert.ok(!/aucun emploi, facture ou devis/i.test(msg), `FR stale promise: ${msg}`);
  });
}

test('formatRecordCounts: EN plurals, singular, zero omission', () => {
  assert.equal(formatRecordCounts({ jobs: 3, invoices: 3, quotes: 2 }, 'en'), '3 jobs, 3 invoices, 2 quotes');
  assert.equal(formatRecordCounts({ jobs: 1, invoices: 0, quotes: 1 }, 'en'), '1 job, 1 quote');
  assert.equal(formatRecordCounts({ jobs: 0, invoices: 0, quotes: 0 }, 'en'), '');
});

test('formatRecordCounts: FR nouns (devis is invariable)', () => {
  assert.equal(formatRecordCounts({ jobs: 3, invoices: 1, quotes: 2 }, 'fr'), '3 emplois, 1 facture, 2 devis');
  assert.equal(formatRecordCounts({ jobs: 1, invoices: 0, quotes: 1 }, 'fr'), '1 emploi, 1 devis');
});
