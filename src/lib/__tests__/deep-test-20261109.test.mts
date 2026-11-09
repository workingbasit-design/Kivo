/**
 * Regression tests for the 2026-11-09 architect deep test (F5):
 * the invoice/quote builders and the share-link manager rendered
 * hardcoded English labels in fr-CA mode ("Customer", "Invoice date",
 * "Notes (optional)", "Public share link", ...). The strings now live
 * in the invoices/quotes/share dictionaries; this test asserts they
 * resolve in both locales, are genuinely translated (FR differs from
 * EN), and keep their {title}/{date} placeholders.
 * Key presence itself is covered by i18n-parity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t } from '../i18n/index.ts';

const KEYS = [
  'invoices.customerLabel',
  'invoices.selectCustomer',
  'invoices.noCustomersYet',
  'invoices.addOneFirst',
  'invoices.dateLabel',
  'invoices.notesOptional',
  'invoices.notesHint',
  'invoices.notesPlaceholder',
  'invoices.lineItems',
  'invoices.forJobNote',
  'quotes.customerLabel',
  'quotes.titleLabel',
  'quotes.titlePlaceholder',
  'quotes.noCustomersYet',
  'quotes.addOneFirst',
  'quotes.lineItems',
  'share.title',
  'share.viewInvoice',
  'share.viewQuote',
  'share.created',
  'share.revoked',
  'share.expiryUpdated',
  'share.expiresLabel',
  'share.saving',
  'share.setExpiry',
  'share.clearExpiry',
  'share.stopsAfter',
  'share.regenerate',
  'share.regenConfirm',
  'share.working',
  'share.yesRegenerate',
  'share.keep',
  'share.revoke',
  'share.revokeConfirm',
  'share.revoking',
  'share.yesRevoke',
  'share.creating',
  'share.createLink',
] as const;

for (const key of KEYS) {
  test(`deep-test-20261109 FR translation exists and differs from EN: ${key}`, () => {
    const en = t('en', key);
    const fr = t('fr', key);
    assert.notEqual(fr, key, `FR missing for ${key} (fell back to key path)`);
    assert.notEqual(en, key, `EN missing for ${key} (fell back to key path)`);
    assert.notEqual(fr, en, `FR untranslated for ${key} (same as EN)`);
  });
}

test('invoices.forJobNote keeps its {title} placeholder in both locales', () => {
  for (const locale of ['en', 'fr'] as const) {
    assert.ok(
      t(locale, 'invoices.forJobNote').includes('{title}'),
      `${locale} forJobNote lost {title}`,
    );
  }
});

test('share.stopsAfter keeps its {date} placeholder in both locales', () => {
  for (const locale of ['en', 'fr'] as const) {
    assert.ok(
      t(locale, 'share.stopsAfter').includes('{date}'),
      `${locale} stopsAfter lost {date}`,
    );
  }
});
