/**
 * Regression tests for the 2026-10-31 deep-test (architect) finding.
 *
 * The customer delete dialog always showed the archive-first message, even
 * after the customer WAS archived — telling the user to "Archive the
 * customer first" on the very step where archiving was already done.
 * DeleteCustomerButton now takes an `archived` prop and picks
 * custDeleteMsgArchived when true. These tests lock the two strings in
 * EN + FR: the archived variant must exist, must not mention archiving
 * first, and must still name the customer via {name}.
 *
 * Run: npm test -- src/lib/__tests__/qa-20261031-delete-dialog.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { t } = await import('../i18n/index.ts');

for (const locale of ['en', 'fr'] as const) {
  test(`custDeleteMsgArchived (${locale}) exists and names the customer`, () => {
    const msg = t(locale, 't10money.custDeleteMsgArchived');
    assert.notEqual(msg, 't10money.custDeleteMsgArchived', 'key missing');
    assert.ok(msg.includes('{name}'), `missing {name} placeholder: ${msg}`);
  });

  test(`custDeleteMsgArchived (${locale}) does not tell an archived customer to archive first`, () => {
    const msg = t(locale, 't10money.custDeleteMsgArchived');
    assert.ok(!/archive (the customer )?first/i.test(msg), `EN stale copy: ${msg}`);
    assert.ok(!/archivez d’abord/i.test(msg), `FR stale copy: ${msg}`);
  });

  test(`custDeleteMsg (${locale}) still states the archive-first rule`, () => {
    const msg = t(locale, 't10money.custDeleteMsg');
    assert.notEqual(msg, 't10money.custDeleteMsg', 'key missing');
    assert.ok(/archiv/i.test(msg), `archive rule missing: ${msg}`);
  });
}
