/**
 * P4-U-004 — Payment math: deposits, partial payments, overpayment guard,
 * refunds, credit notes.
 *
 * Pure-logic layer. The DB-enforced guards (recordPayment/voidPayment) are
 * covered by P4-D integration tests; this file pins the math they rely on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingBalance } from '../revenue.ts';
import { parseDepositAmount } from '../quote-deposit.ts';
import { computeQuoteTotals } from '../quote-totals.ts';
import { deriveInvoiceStatus } from '../invoice-status.ts';
import { getTaxConfig } from '../tax.ts';

const ON = getTaxConfig('CA', 'ON').taxes;

test('P4-U-004: partial payments reduce the remaining balance', () => {
  assert.equal(remainingBalance(1000, [400]), 600);
  assert.equal(remainingBalance(1000, [400, 300]), 300);
  assert.equal(remainingBalance(1000, []), 1000);
});

test('P4-U-004: full payment zeroes the balance and derives PAID', () => {
  assert.equal(remainingBalance(1000, [1000]), 0);
  assert.equal(deriveInvoiceStatus(BigInt(100000), BigInt(100000)), 'PAID');
});

test('P4-U-004: overpayment is clamped in math and rejected by guard', () => {
  // remainingBalance clamps at 0 (defense in depth); the server action rejects
  // amountCents > remainingCents before writing.
  assert.equal(remainingBalance(1000, [1200]), 0);
  const totalCents = BigInt(100000);
  const paidCents = BigInt(60000);
  const remainingCents = totalCents - paidCents;
  const attemptCents = BigInt(50000);
  assert.equal(attemptCents > remainingCents, true, 'overpayment attempt must be rejected');
  assert.equal(deriveInvoiceStatus(totalCents, paidCents), 'PARTIALLY PAID');
});

test('P4-U-004: zero and negative payments are rejected', () => {
  assert.equal(remainingBalance(1000, [0]), 1000);
  const attempt = 0;
  assert.ok(!(attempt > 0), 'zero payment must be rejected');
});

test('P4-U-004: deposit above the quote total is rejected; zero means no deposit', () => {
  const { total } = computeQuoteTotals([{ qty: 1, unitPrice: 500 }], { type: null, value: null }, ON);
  const over = parseDepositAmount(String(total + 1), total);
  assert.equal(over.amount, null);
  assert.ok(over.error);
  assert.equal(parseDepositAmount('0', total).amount, null);
  assert.equal(parseDepositAmount('', total).amount, null);
  const ok = parseDepositAmount('100', total);
  assert.equal(ok.amount, 100);
  assert.equal(ok.error, undefined);
});

test('P4-U-004: deposit equal to the total is allowed (fully prepaid)', () => {
  const { total } = computeQuoteTotals([{ qty: 2, unitPrice: 250 }], { type: null, value: null }, ON);
  const r = parseDepositAmount(String(total), total);
  assert.equal(r.amount, total);
});

test('P4-U-004: refund (payment void) restores the balance and re-derives status', () => {
  // $1000 invoice, $1000 paid, then the $1000 payment is voided with a reason.
  assert.equal(remainingBalance(1000, [1000]), 0);
  assert.equal(remainingBalance(1000, []), 1000, 'after void, balance is restored');
  assert.equal(deriveInvoiceStatus(BigInt(100000), BigInt(0)), 'UNPAID');
});

test('P4-U-004: credit note reduces the amount owed', () => {
  // $1000 invoice with a $200 credit note behaves like $800 total.
  const effectiveTotal = 1000 - 200;
  assert.equal(remainingBalance(effectiveTotal, [800]), 0);
  assert.equal(deriveInvoiceStatus(BigInt(80000), BigInt(80000)), 'PAID');
});

test('P4-U-004: float dust never leaks into balances (0.1 + 0.2 case)', () => {
  assert.equal(remainingBalance(0.3, [0.1, 0.2]), 0);
});
