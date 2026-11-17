/**
 * Money hub math (Money redesign, 2026-11-17).
 *
 * Pins the hub's money truth in the pure layer: a voided payment is never
 * money, outstanding is the unpaid remainder of live invoices, and the
 * activity feed merges the three real sources newest-first.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { remainingCents, buildMoneyActivity, filterMoneyActivity } = await import(
  '../money-hub.ts'
);

describe('money hub: remainingCents', () => {
  test('unpaid invoice owes its full total', () => {
    assert.equal(remainingCents(BigInt(15000), []), BigInt(15000));
  });

  test('partial payment reduces the remainder', () => {
    assert.equal(
      remainingCents(BigInt(15000), [
        { amountCents: BigInt(6000), status: 'COMPLETED' },
      ]),
      BigInt(9000)
    );
  });

  test('voided, failed and pending payments are not money', () => {
    assert.equal(
      remainingCents(BigInt(15000), [
        { amountCents: BigInt(6000), status: 'COMPLETED' },
        { amountCents: BigInt(9000), status: 'VOID' },
        { amountCents: BigInt(5000), status: 'FAILED' },
        { amountCents: BigInt(4000), status: 'PENDING' },
      ]),
      BigInt(9000)
    );
  });

  test('a fully paid invoice owes zero, never a negative remainder', () => {
    assert.equal(
      remainingCents(BigInt(10000), [
        { amountCents: BigInt(10000), status: 'COMPLETED' },
      ]),
      BigInt(0)
    );
    // Stale-read guard: overpayment clamps to zero instead of going negative.
    assert.equal(
      remainingCents(BigInt(10000), [
        { amountCents: BigInt(12000), status: 'COMPLETED' },
      ]),
      BigInt(0)
    );
  });
});

const item = (
  id: string,
  kind: 'income' | 'expense' | 'invoice',
  sortMs: number
) => ({
  id,
  kind,
  title: id,
  detail: '',
  date: new Date(sortMs).toISOString(),
  amountCents: 100,
  party: '',
  href: '#',
  sortMs,
});

describe('money hub: buildMoneyActivity', () => {
  test('merges the three sources newest-first by creation instant', () => {
    const merged = buildMoneyActivity([
      item('old-invoice', 'invoice', 1000),
      item('new-payment', 'income', 3000),
      item('mid-expense', 'expense', 2000),
    ]);
    assert.deepEqual(
      merged.map((i) => i.id),
      ['new-payment', 'mid-expense', 'old-invoice']
    );
  });

  test('does not mutate the input array', () => {
    const input = [item('a', 'income', 1000), item('b', 'income', 2000)];
    buildMoneyActivity(input);
    assert.equal(input[0].id, 'a');
  });

  test('empty input stays empty', () => {
    assert.deepEqual(buildMoneyActivity([]), []);
  });
});

describe('money hub: filterMoneyActivity', () => {
  const feed = buildMoneyActivity([
    item('pay-1', 'income', 3000),
    item('exp-1', 'expense', 2000),
    item('inv-1', 'invoice', 1000),
  ]);

  test('all keeps every row', () => {
    assert.equal(filterMoneyActivity(feed, 'all').length, 3);
  });

  test('each kind filter keeps only its rows', () => {
    assert.deepEqual(
      filterMoneyActivity(feed, 'income').map((i) => i.id),
      ['pay-1']
    );
    assert.deepEqual(
      filterMoneyActivity(feed, 'expense').map((i) => i.id),
      ['exp-1']
    );
    assert.deepEqual(
      filterMoneyActivity(feed, 'invoice').map((i) => i.id),
      ['inv-1']
    );
  });
});
