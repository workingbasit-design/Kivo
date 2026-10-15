/**
 * Regression tests for the 2026-10-15 morning QA findings.
 *
 * 1. Customer delete dialog copy claimed cascade deletion
 *    ("Jobs and invoices linked to them will also be removed") while the
 *    backend (launch-pack item 6) REFUSES to delete customers with linked
 *    records. The copy now states the archive-first rule.
 * 2. Launch-pack item 7: voidInvoice/voidPayment server actions existed with
 *    NO UI, so non-draft invoices could never be voided. The UI added today
 *    shares the >=10-char reason rule via src/lib/voiding.ts - locked here.
 * 3. The job form's "No charge" checkbox was hardcoded English (FR leakage).
 *
 * Run: npm test -- src/lib/__tests__/qa-20261015-void-archive.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { t } = await import('../i18n/index.ts');
const { isValidVoidReason, VOID_REASON_MIN_LENGTH } = await import(
  '../voiding.ts'
);

// --- 1. Customer delete copy must not promise cascade deletion ---
for (const locale of ['en', 'fr'] as const) {
  test(`custDeleteMsg (${locale}) does not claim linked records are removed`, () => {
    const msg = t(locale, 't10money.custDeleteMsg');
    assert.notEqual(msg, 't10money.custDeleteMsg', 'key missing');
    assert.ok(
      !/will also be removed/i.test(msg),
      `EN cascade claim leaked: ${msg}`
    );
    assert.ok(
      !/seront aussi supprim/i.test(msg),
      `FR cascade claim leaked: ${msg}`
    );
  });

  test(`custDeleteMsg (${locale}) states the archive-first rule`, () => {
    const msg = t(locale, 't10money.custDeleteMsg').toLowerCase();
    assert.ok(
      locale === 'en' ? msg.includes('archiv') : msg.includes('archiv'),
      `archive rule missing: ${msg}`
    );
  });
}

// --- 2. Void reason rule: >= 10 chars after trim ---
test('VOID_REASON_MIN_LENGTH is 10 (launch-pack item 7)', () => {
  assert.equal(VOID_REASON_MIN_LENGTH, 10);
});

test('isValidVoidReason rejects short reasons', () => {
  assert.equal(isValidVoidReason(''), false);
  assert.equal(isValidVoidReason('too short'), false);
  assert.equal(isValidVoidReason('123456789'), false, '9 chars must fail');
  assert.equal(isValidVoidReason('   123456789   '), false, 'trimmed 9 chars must fail');
});

test('isValidVoidReason accepts 10+ chars', () => {
  assert.equal(isValidVoidReason('1234567890'), true, 'exactly 10 chars');
  assert.equal(
    isValidVoidReason('Issued in error, reissued as INV-0005'),
    true
  );
  assert.equal(
    isValidVoidReason('  Issued in error, reissued  '),
    true,
    'surrounding whitespace is trimmed'
  );
});

test('isValidVoidReason rejects non-strings', () => {
  assert.equal(isValidVoidReason(null), false);
  assert.equal(isValidVoidReason(undefined), false);
  assert.equal(isValidVoidReason(12345678901), false);
});

// --- 2b. Void/archive i18n keys exist in EN+FR and are translated ---
const MONEY_KEYS = [
  't10money.invVoid',
  't10money.invVoidTitle',
  't10money.invVoidMsg',
  't10money.invVoidReason',
  't10money.invVoidReasonPh',
  't10money.invVoidReasonShort',
  't10money.invVoiding',
  't10money.invVoided',
  't10money.invVoidPayment',
  't10money.invVoidPaymentTitle',
  't10money.invVoidPaymentMsg',
  't10money.invPaymentVoided',
  't10money.invVoidedBadge',
  't10money.custArchive',
  't10money.custArchiving',
  't10money.custArchived',
  't10money.custRestore',
  't10money.custRestoring',
  't10money.custRestored',
  't10money.custArchivedBadge',
] as const;

for (const key of MONEY_KEYS) {
  test(`i18n FR translated and differs from EN: ${key}`, () => {
    const en = t('en', key);
    const fr = t('fr', key);
    assert.notEqual(en, key, `EN missing for ${key}`);
    assert.notEqual(fr, key, `FR missing for ${key} (fell back to key path)`);
    assert.notEqual(fr, en, `FR untranslated for ${key} (same as EN)`);
  });
}

// --- 3. "No charge" checkbox is translated ---
test('t10work.formNoCharge FR differs from EN (2026-10-15 FR leakage fix)', () => {
  const en = t('en', 't10work.formNoCharge');
  const fr = t('fr', 't10work.formNoCharge');
  assert.notEqual(en, 't10work.formNoCharge');
  assert.notEqual(fr, 't10work.formNoCharge');
  assert.notEqual(fr, en);
});
