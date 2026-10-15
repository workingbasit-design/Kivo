/**
 * P4-U-020 — Status transition rules for jobs, quotes, invoices.
 *
 * Jobs: isValidTransition (job-status.ts). Quotes: QUOTE_TRANSITIONS
 * (quote-status.ts). Invoices: payment status is DERIVED from money
 * (invoice-status.ts) — never set directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTransition, validNextStatuses } from '../job-status.ts';
import { QUOTE_TRANSITIONS, isValidQuoteTransition } from '../quote-status.ts';
import { deriveInvoiceStatus } from '../invoice-status.ts';

/* ---- jobs (canonical rules, job-status.ts) ---- */

test('P4-U-020: job forward pipeline moves are all allowed', () => {
  const pipe = ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'];
  for (let i = 0; i < pipe.length; i++) {
    for (let j = i + 1; j < pipe.length; j++) {
      assert.equal(isValidTransition(pipe[i], pipe[j]), true, `${pipe[i]} -> ${pipe[j]}`);
    }
  }
});

test('P4-U-020: job backward moves allow exactly one step (mistake undo)', () => {
  assert.equal(isValidTransition('COMPLETED', 'IN PROGRESS'), true);
  assert.equal(isValidTransition('SCHEDULED', 'NEW'), true);
  assert.equal(isValidTransition('PAID', 'COMPLETED'), true, 'one step back from PAID is allowed');
  assert.equal(isValidTransition('COMPLETED', 'SCHEDULED'), false, 'two steps back rejected');
  assert.equal(isValidTransition('COMPLETED', 'NEW'), false, 'three steps back rejected');
});

test('P4-U-020: job CANCELLED rules', () => {
  for (const s of ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED']) {
    assert.equal(isValidTransition(s, 'CANCELLED'), true, s);
  }
  assert.equal(isValidTransition('PAID', 'CANCELLED'), false);
  assert.equal(isValidTransition('CANCELLED', 'CANCELLED'), true); // no-op
  assert.equal(isValidTransition('CANCELLED', 'NEW'), true);
  assert.equal(isValidTransition('CANCELLED', 'SCHEDULED'), true);
  assert.equal(isValidTransition('CANCELLED', 'IN PROGRESS'), false);
  assert.equal(isValidTransition('CANCELLED', 'PAID'), false);
});

test('P4-U-020: job same-status is a no-op; unknown statuses rejected', () => {
  assert.equal(isValidTransition('NEW', 'NEW'), true);
  assert.equal(isValidTransition('BOGUS', 'NEW'), false);
  assert.equal(isValidTransition('NEW', 'BOGUS'), false);
});

test('P4-U-020: validNextStatuses never offers a rejected move', () => {
  for (const s of ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID', 'CANCELLED']) {
    for (const n of validNextStatuses(s)) {
      assert.equal(isValidTransition(s, n), true, `${s} -> ${n}`);
    }
  }
});

/* ---- quotes (quote-status.ts) ---- */

test('P4-U-020: quote DRAFT -> SENT -> APPROVED happy path', () => {
  assert.equal(isValidQuoteTransition('DRAFT', 'SENT'), true);
  assert.equal(isValidQuoteTransition('SENT', 'APPROVED'), true);
});

test('P4-U-020: quote terminal states are terminal', () => {
  for (const to of ['DRAFT', 'SENT', 'APPROVED', 'DECLINED']) {
    assert.equal(isValidQuoteTransition('APPROVED', to), to === 'APPROVED', `APPROVED -> ${to}`);
  }
});

test('P4-U-020: quote DECLINED can return to DRAFT; SENT can be recalled', () => {
  assert.equal(isValidQuoteTransition('DECLINED', 'DRAFT'), true);
  assert.equal(isValidQuoteTransition('SENT', 'DRAFT'), true);
  assert.equal(isValidQuoteTransition('DECLINED', 'APPROVED'), false);
  assert.equal(isValidQuoteTransition('DRAFT', 'APPROVED'), false); // must be SENT first
});

test('P4-U-020: QUOTE_TRANSITIONS covers every QUOTE_STATUSES value', () => {
  for (const s of ['DRAFT', 'SENT', 'APPROVED', 'DECLINED']) {
    assert.ok(Array.isArray(QUOTE_TRANSITIONS[s]), s);
  }
});

/* ---- invoices: status derived from money ---- */

test('P4-U-020: invoice status derives from paid vs total cents', () => {
  assert.equal(deriveInvoiceStatus(BigInt(10000), BigInt(0)), 'UNPAID');
  assert.equal(deriveInvoiceStatus(BigInt(10000), BigInt(1)), 'PARTIALLY PAID');
  assert.equal(deriveInvoiceStatus(BigInt(10000), BigInt(9999)), 'PARTIALLY PAID');
  assert.equal(deriveInvoiceStatus(BigInt(10000), BigInt(10000)), 'PAID');
});

test('P4-U-020: invoice overpayment can never produce a 4th status', () => {
  // Overpayment is rejected upstream (recordPayment guard); derivation clamps to PAID.
  assert.equal(deriveInvoiceStatus(BigInt(10000), BigInt(10001)), 'PAID');
});
