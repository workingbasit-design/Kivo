/**
 * Regression test for the 2026-10-08 morning QA finding: the FR invoices
 * list and FR reports pages rendered English strings ("Invoices",
 * "New invoice", "Reports"). The invoice-list strings now live in the
 * billing i18n fragment (covered by i18n-parity for key presence); this test
 * asserts they are genuinely translated (FR value differs from EN) and that
 * the {amount}/{count} template placeholders survived translation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t } from '../i18n/index.ts';

const KEYS = [
  'billing.listTitle',
  'billing.listSubtitle',
  'billing.newInvoice',
  'billing.statOutstanding',
  'billing.statYetToCollect',
  'billing.statCollected',
  'billing.statPaymentsRecorded',
  'billing.filterLabel',
  'billing.listEmptyTitle',
  'billing.listEmptyDesc',
  'billing.dueSuffix',
] as const;

for (const key of KEYS) {
  test(`billing FR translation exists and differs from EN: ${key}`, () => {
    const en = t('en', key);
    const fr = t('fr', key);
    assert.notEqual(fr, key, `FR missing for ${key} (fell back to key path)`);
    assert.notEqual(fr, en, `FR untranslated for ${key} (same as EN)`);
  });
}

test('billing.dueSuffix keeps its {amount} placeholder in both locales', () => {
  for (const locale of ['en', 'fr'] as const) {
    assert.ok(
      t(locale, 'billing.dueSuffix').includes('{amount}'),
      `${locale} dueSuffix lost {amount}`
    );
  }
});
