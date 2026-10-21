/**
 * Regression tests for the 2026-10-21 morning QA finding:
 * void-payment-totals-not-recomputed.
 *
 * Voiding a payment (valid >=10-char reason) marked the payment row VOID but
 * left the invoice PAID with a $0 balance, kept it in "Collected", and hid it
 * from outstanding/attention - contradicting the dialog copy "Totals and
 * reports will exclude it".
 *
 * The fix: invoice payment status is derived from money, never set directly.
 * Only COMPLETED payments count as received money; voidPayment recomputes the
 * invoice status inside the same transaction; every read path sums via
 * sumMoneyPayments (src/lib/invoice-status.ts).
 *
 * Final polish (2026-10-21): the /money "Awaiting payment" section TOTAL
 * already summed via sumMoneyPayments, but the per-ROW balance summed all
 * payments, so a paid-then-voided invoice showed "Balance due: $0.00" while
 * its section total was correct. Section 5 pins the row computation.
 *
 * Run: npm test -- src/lib/__tests__/qa-20261021-void-payment.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./register-loader.mjs', import.meta.url);

const {
  countsAsMoney,
  sumMoneyPayments,
  deriveStatusFromPayments,
  deriveInvoiceStatus,
} = await import('../invoice-status.ts');
const { remainingBalance } = await import('../revenue.ts');
const { centsToDollars } = await import('../money.ts');

// --- 1. Money truth: only COMPLETED counts ---
test('countsAsMoney: COMPLETED counts as money', () => {
  assert.equal(countsAsMoney('COMPLETED'), true);
});

test('countsAsMoney: VOID/FAILED/PENDING never count as money', () => {
  for (const s of ['VOID', 'FAILED', 'PENDING']) {
    assert.equal(countsAsMoney(s), false, `${s} must not count as money`);
  }
});

// --- 2. sumMoneyPayments excludes voided payments ---
test('sumMoneyPayments ignores VOID payments', () => {
  const sum = sumMoneyPayments([
    { amountCents: BigInt(4520), status: 'COMPLETED' },
    { amountCents: BigInt(4520), status: 'VOID' },
    { amountCents: BigInt(1000), status: 'FAILED' },
  ]);
  assert.equal(sum, BigInt(4520));
});

test('sumMoneyPayments of an all-voided list is zero', () => {
  assert.equal(
    sumMoneyPayments([{ amountCents: BigInt(4520), status: 'VOID' }]),
    BigInt(0)
  );
});

// --- 3. The QA scenario: $45.20 invoice, payment recorded then voided ---
test('deriveStatusFromPayments: single full payment -> PAID', () => {
  const status = deriveStatusFromPayments(BigInt(4520), [
    { amountCents: BigInt(4520), status: 'COMPLETED' },
  ]);
  assert.equal(status, 'PAID');
});

test('deriveStatusFromPayments: after the payment is voided -> UNPAID', () => {
  // This is the exact regression: before the fix, voidPayment never
  // recomputed, so the invoice stayed PAID with a $0 balance.
  const status = deriveStatusFromPayments(BigInt(4520), [
    { amountCents: BigInt(4520), status: 'VOID' },
  ]);
  assert.equal(status, 'UNPAID');
});

test('deriveStatusFromPayments: voided payment plus a smaller live payment -> PARTIALLY PAID', () => {
  const status = deriveStatusFromPayments(BigInt(4520), [
    { amountCents: BigInt(4520), status: 'VOID' },
    { amountCents: BigInt(2000), status: 'COMPLETED' },
  ]);
  assert.equal(status, 'PARTIALLY PAID');
});

test('deriveStatusFromPayments: no payments -> UNPAID', () => {
  assert.equal(deriveStatusFromPayments(BigInt(4520), []), 'UNPAID');
});

// --- 4. deriveInvoiceStatus still the single derivation primitive ---
test('deriveInvoiceStatus unchanged: full/partial/none', () => {
  assert.equal(deriveInvoiceStatus(BigInt(4520), BigInt(4520)), 'PAID');
  assert.equal(deriveInvoiceStatus(BigInt(4520), BigInt(1)), 'PARTIALLY PAID');
  assert.equal(deriveInvoiceStatus(BigInt(4520), BigInt(0)), 'UNPAID');
});

// --- 5. /money "Awaiting payment" ROW balance (final polish 2026-10-21) ---
// The money-page row formatter summed ALL payments, voided included, so a
// paid-then-voided invoice rendered "Balance due: $0.00" while the section
// total (computed via sumMoneyPayments) correctly showed the full balance.
// moneyRowBalance mirrors the page's row computation exactly; the page
// formula itself is pinned by the source-wiring test below.
function moneyRowBalance(
  totalCents: bigint,
  payments: { amountCents: bigint; status: string }[],
): number {
  return remainingBalance(centsToDollars(totalCents), [
    centsToDollars(sumMoneyPayments(payments)),
  ]);
}

test('money row balance: the live INV-0003 case — $226 paid in full, then voided -> row shows $226', () => {
  const balance = moneyRowBalance(BigInt(22600), [
    { amountCents: BigInt(22600), status: 'VOID' },
  ]);
  assert.equal(balance, 226);
});

test('money row balance: a live COMPLETED payment still counts against the row', () => {
  const balance = moneyRowBalance(BigInt(22600), [
    { amountCents: BigInt(22600), status: 'COMPLETED' },
  ]);
  assert.equal(balance, 0);
});

test('money row balance: voided partial payment ignored, live partial counts', () => {
  const balance = moneyRowBalance(BigInt(22600), [
    { amountCents: BigInt(10000), status: 'COMPLETED' },
    { amountCents: BigInt(5000), status: 'VOID' },
  ]);
  assert.equal(balance, 126);
});

test('money page source: row balance counts COMPLETED-only payments, like the section total', () => {
  const src = readFileSync(
    new URL('../../app/(app)/money/page.tsx', import.meta.url),
    'utf8',
  );
  // Both the section total and the per-row computation must sum via
  // sumMoneyPayments (COMPLETED-only).
  const occurrences = src.split('sumMoneyPayments(inv.payments)').length - 1;
  assert.ok(
    occurrences >= 2,
    `expected >=2 sumMoneyPayments(inv.payments) uses (total + row), found ${occurrences}`,
  );
  // The pre-fix row formula summed every payment row regardless of status.
  assert.doesNotMatch(src, /inv\.payments\.map\(\(p\) => centsToDollars\(p\.amountCents\)\)/);
});
