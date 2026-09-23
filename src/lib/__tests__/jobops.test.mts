/**
 * Tests for src/lib/costing.ts: job-costing math, expense validation,
 * labor-duration summation, and CSV escaping.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sumLaborMinutes,
  expenseTotals,
  summarizeJobCost,
  validateExpenseInput,
  parseHourlyRateInput,
  validateChecklistLabel,
  parseTemplateItemLines,
  escapeCsvCell,
  summarizeLineItems,
} from '../costing.ts';

/* ---------------- labor duration summation ---------------- */

test('sumLaborMinutes: sums completed entries, excludes running ones', () => {
  const mins = sumLaborMinutes([
    { clockIn: '2026-09-20T09:00:00', clockOut: '2026-09-20T10:30:00' }, // 90
    { clockIn: '2026-09-20T11:00:00', clockOut: '2026-09-20T11:45:00' }, // 45
    { clockIn: new Date('2026-09-20T12:00:00'), clockOut: null }, // running -> excluded
  ]);
  assert.equal(mins, 135);
});

test('sumLaborMinutes: ignores invalid or negative durations', () => {
  const mins = sumLaborMinutes([
    { clockIn: 'not-a-date', clockOut: '2026-09-20T10:00:00' },
    { clockIn: '2026-09-20T12:00:00', clockOut: '2026-09-20T11:00:00' }, // backwards
  ]);
  assert.equal(mins, 0);
});

/* ---------------- expense totals ---------------- */

test('expenseTotals: groups by category', () => {
  const t = expenseTotals([
    { amount: 40, category: 'MATERIALS' },
    { amount: 12.5, category: 'TRAVEL' },
    { amount: 7, category: 'OTHER' },
    { amount: 20, category: 'MATERIALS' },
  ]);
  assert.deepEqual(t, { materials: 60, travel: 12.5, other: 7, total: 79.5 });
});

test('expenseTotals: skips non-positive amounts', () => {
  const t = expenseTotals([
    { amount: -5, category: 'MATERIALS' },
    { amount: 0, category: 'TRAVEL' },
    { amount: 10, category: 'OTHER' },
  ]);
  assert.deepEqual(t, { materials: 0, travel: 0, other: 10, total: 10 });
});

/* ---------------- costing math ---------------- */

test('summarizeJobCost: profit and margin with labor + expenses', () => {
  const s = summarizeJobCost({
    price: 500,
    laborMinutes: 180, // 3h
    hourlyRate: 60,
    expenses: [
      { amount: 40, category: 'MATERIALS' },
      { amount: 20, category: 'TRAVEL' },
    ],
  });
  assert.equal(s.laborHours, 3);
  assert.equal(s.laborCost, 180);
  assert.equal(s.materialsCost, 40);
  assert.equal(s.travelCost, 20);
  assert.equal(s.expensesTotal, 60);
  assert.equal(s.totalCost, 240);
  assert.equal(s.profit, 260);
  assert.equal(s.marginPct, 52);
});

test('summarizeJobCost: zero price guards margin (no divide-by-zero)', () => {
  const s = summarizeJobCost({
    price: 0,
    laborMinutes: 60,
    hourlyRate: 50,
    expenses: [],
  });
  assert.equal(s.profit, -50);
  assert.equal(s.marginPct, null);
});

test('summarizeJobCost: null price treated as 0', () => {
  const s = summarizeJobCost({
    price: null,
    laborMinutes: 0,
    hourlyRate: null,
    expenses: [{ amount: 15, category: 'OTHER' }],
  });
  assert.equal(s.price, 0);
  assert.equal(s.laborCost, 0); // no rate -> labor valued at 0
  assert.equal(s.totalCost, 15);
  assert.equal(s.profit, -15);
  assert.equal(s.marginPct, null);
});

test('summarizeJobCost: negative hourly rate never inflates profit', () => {
  const s = summarizeJobCost({
    price: 200,
    laborMinutes: 60,
    hourlyRate: -10,
    expenses: [],
  });
  assert.equal(s.laborCost, 0);
  assert.equal(s.profit, 200);
});

/* ---------------- expense validation ---------------- */

test('validateExpenseInput: accepts a valid expense', () => {
  const r = validateExpenseInput({
    description: 'Copper pipe',
    amount: '42.50',
    category: 'materials',
    spentAt: '2026-09-23',
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.description, 'Copper pipe');
    assert.equal(r.data.amount, 42.5);
    assert.equal(r.data.category, 'MATERIALS');
    assert.equal(r.data.spentAt.getFullYear(), 2026);
  }
});

test('validateExpenseInput: rejects missing description', () => {
  const r = validateExpenseInput({ description: '  ', amount: 5, category: 'TRAVEL', spentAt: '2026-09-23' });
  assert.equal(r.ok, false);
});

test('validateExpenseInput: rejects zero/negative/non-numeric amounts', () => {
  for (const amount of [0, -3, 'abc', '']) {
    const r = validateExpenseInput({ description: 'x', amount, category: 'OTHER', spentAt: '2026-09-23' });
    assert.equal(r.ok, false, `amount ${JSON.stringify(amount)} should be rejected`);
  }
});

test('validateExpenseInput: rejects unknown category', () => {
  const r = validateExpenseInput({ description: 'x', amount: 5, category: 'FOOD', spentAt: '2026-09-23' });
  assert.equal(r.ok, false);
});

test('validateExpenseInput: rejects bad dates', () => {
  for (const spentAt of ['2026-13-01', '2026-02-30', 'nope', '']) {
    const r = validateExpenseInput({ description: 'x', amount: 5, category: 'OTHER', spentAt });
    assert.equal(r.ok, false, `date ${JSON.stringify(spentAt)} should be rejected`);
  }
});

/* ---------------- hourly rate + checklist label ---------------- */

test('parseHourlyRateInput: empty clears the rate, bad values rejected', () => {
  assert.deepEqual(parseHourlyRateInput(''), { ok: true, data: null });
  assert.deepEqual(parseHourlyRateInput('  '), { ok: true, data: null });
  const ok = parseHourlyRateInput('65.50');
  assert.equal(ok.ok, true);
  const bad = parseHourlyRateInput('-5');
  assert.equal(bad.ok, false);
  const nan = parseHourlyRateInput('abc');
  assert.equal(nan.ok, false);
});

test('validateChecklistLabel: trims, requires non-empty, caps length', () => {
  const ok = validateChecklistLabel('  Confirm parking  ');
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data, 'Confirm parking');
  assert.equal(validateChecklistLabel('   ').ok, false);
  assert.equal(validateChecklistLabel('x'.repeat(201)).ok, false);
});

test('parseTemplateItemLines: one label per line, drops blanks, caps', () => {
  const lines = parseTemplateItemLines('  First\n\nSecond  \n   \nThird', 50);
  assert.deepEqual(lines, ['First', 'Second', 'Third']);
  const capped = parseTemplateItemLines(Array(80).fill('x').join('\n'), 50);
  assert.equal(capped.length, 50);
});

/* ---------------- CSV escaping ---------------- */

test('escapeCsvCell: leaves plain values alone', () => {
  assert.equal(escapeCsvCell('hello'), 'hello');
  assert.equal(escapeCsvCell(42), '42');
  assert.equal(escapeCsvCell(null), '');
  assert.equal(escapeCsvCell(undefined), '');
});

test('escapeCsvCell: quotes commas, quotes, and newlines', () => {
  assert.equal(escapeCsvCell('a,b'), '"a,b"');
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCsvCell('a\rb'), '"a\rb"');
});

test('escapeCsvCell: tricky invoice values stay intact', () => {
  const cell = escapeCsvCell('ACME, Inc. "Best" Co.\nSuite 5');
  assert.equal(cell, '"ACME, Inc. ""Best"" Co.\nSuite 5"');
  // round-trip: strip outer quotes, un-double inner quotes
  const inner = cell.slice(1, -1).replace(/""/g, '"');
  assert.equal(inner, 'ACME, Inc. "Best" Co.\nSuite 5');
});

test('summarizeLineItems: builds a compact one-line summary', () => {
  const s = summarizeLineItems([
    { description: 'Mowing', qty: 2, unitPrice: 50 },
    { description: 'Hauling', qty: 1, unitPrice: 120.5 },
  ]);
  assert.equal(s, 'Mowing (2 × 50); Hauling (1 × 120.5)');
  assert.equal(summarizeLineItems([]), '');
});
