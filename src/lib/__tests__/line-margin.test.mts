import test from 'node:test';
import assert from 'node:assert/strict';
import { lineMargin, summarizeLineMargins } from '../line-margin.ts';

test('lineMargin: basic margin dollars and percent', () => {
  assert.deepEqual(lineMargin({ qty: 1, unitPriceCents: 10000, unitCostCents: 6000 }), {
    revenueCents: 10000,
    costCents: 6000,
    marginCents: 4000,
    marginPct: 40,
  });
});

test('lineMargin: qty scales revenue and cost', () => {
  const m = lineMargin({ qty: 2, unitPriceCents: 10000, unitCostCents: 6000 });
  assert.equal(m?.revenueCents, 20000);
  assert.equal(m?.costCents, 12000);
  assert.equal(m?.marginCents, 8000);
  assert.equal(m?.marginPct, 40);
});

test('lineMargin: null cost means unknown, never $0', () => {
  assert.equal(lineMargin({ qty: 1, unitPriceCents: 10000, unitCostCents: null }), null);
});

test('lineMargin: zero revenue gives null percent but real margin cents', () => {
  const m = lineMargin({ qty: 1, unitPriceCents: 0, unitCostCents: 5000 });
  assert.equal(m?.marginCents, -5000);
  assert.equal(m?.marginPct, null);
});

test('lineMargin: fractional qty rounds to the cent', () => {
  // 1.5 × $33.33 = $49.995 → $50.00; 1.5 × $10.00 = $15.00.
  const m = lineMargin({ qty: 1.5, unitPriceCents: 3333, unitCostCents: 1000 });
  assert.equal(m?.revenueCents, 5000);
  assert.equal(m?.costCents, 1500);
  assert.equal(m?.marginCents, 3500);
});

test('lineMargin: negative margin (loss) is reported, not clamped', () => {
  const m = lineMargin({ qty: 1, unitPriceCents: 5000, unitCostCents: 8000 });
  assert.equal(m?.marginCents, -3000);
  assert.equal(m?.marginPct, -60);
});

test('summarizeLineMargins: margin over costed lines only', () => {
  const s = summarizeLineMargins([
    { qty: 1, unitPriceCents: 10000, unitCostCents: 6000 },
    { qty: 1, unitPriceCents: 20000, unitCostCents: null },
  ]);
  assert.equal(s.totalRevenueCents, 30000);
  assert.equal(s.costedRevenueCents, 10000);
  assert.equal(s.costCents, 6000);
  assert.equal(s.marginCents, 4000);
  assert.equal(s.marginPct, 40);
  assert.equal(s.costedLines, 1);
  assert.equal(s.totalLines, 2);
});

test('summarizeLineMargins: all unknown costs give no margin', () => {
  const s = summarizeLineMargins([
    { qty: 1, unitPriceCents: 10000, unitCostCents: null },
  ]);
  assert.equal(s.costedLines, 0);
  assert.equal(s.marginCents, 0);
  assert.equal(s.marginPct, null);
});

test('summarizeLineMargins: empty document', () => {
  const s = summarizeLineMargins([]);
  assert.deepEqual(
    { total: s.totalRevenueCents, costed: s.costedLines, pct: s.marginPct },
    { total: 0, costed: 0, pct: null }
  );
});
