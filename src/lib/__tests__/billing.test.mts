/**
 * Unit tests for Track 8C pure billing helpers (src/lib/billing.ts) and the
 * billing i18n fragment. No DB, no network.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/billing.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBatchPreview,
  excludeInvoicedJobs,
  validateMilestoneInput,
} from '../billing.ts';
import fragment from '../i18n/fragments/billing.ts';

test('buildBatchPreview computes per-row subtotal/tax/total', () => {
  const rows = buildBatchPreview(
    [
      { id: 'j1', title: 'Furnace tune-up', price: 100, customerName: 'Alice', date: '2026-09-20' },
      { id: 'j2', title: 'Drain clean', price: 33.333, customerName: 'Bob', date: '2026-09-21' },
    ],
    13
  );
  assert.equal(rows.length, 2);

  assert.deepEqual(
    { subtotal: rows[0].subtotal, taxAmount: rows[0].taxAmount, total: rows[0].total },
    { subtotal: 100, taxAmount: 13, total: 113 }
  );

  // Rounding: subtotal is rounded first, then tax is computed on it.
  assert.deepEqual(
    { subtotal: rows[1].subtotal, taxAmount: rows[1].taxAmount, total: rows[1].total },
    { subtotal: 33.33, taxAmount: 4.33, total: 37.66 }
  );

  assert.equal(rows[0].jobId, 'j1');
  assert.equal(rows[0].customerName, 'Alice');
});

test('buildBatchPreview with zero tax keeps price as total', () => {
  const [row] = buildBatchPreview(
    [{ id: 'j1', title: 'Free visit', price: 50, customerName: 'Cara', date: '2026-09-22' }],
    0
  );
  assert.equal(row.taxAmount, 0);
  assert.equal(row.total, 50);
});

test('validateMilestoneInput accepts valid input', () => {
  const res = validateMilestoneInput({
    label: 'Deposit',
    amount: '250.50',
    description: 'Materials deposit',
  });
  assert.equal(res.ok, true);
  assert.deepEqual(
    res.ok && res.clean,
    { label: 'Deposit', amount: 250.5, description: 'Materials deposit' }
  );

  // Amount as a number, no description.
  const res2 = validateMilestoneInput({ label: 'Final', amount: 100 });
  assert.equal(res2.ok, true);
});

test('validateMilestoneInput rejects bad input with billing error keys', () => {
  const cases: Array<{ input: Parameters<typeof validateMilestoneInput>[0]; key: string }> = [
    { input: { label: '   ', amount: 100 }, key: 'billing.errors.labelRequired' },
    { input: { label: 'x'.repeat(81), amount: 100 }, key: 'billing.errors.labelTooLong' },
    { input: { label: 'Deposit', amount: 'abc' }, key: 'billing.errors.amountInvalid' },
    { input: { label: 'Deposit', amount: 0 }, key: 'billing.errors.amountTooSmall' },
    { input: { label: 'Deposit', amount: -5 }, key: 'billing.errors.amountTooSmall' },
    { input: { label: 'Deposit', amount: 1_000_000.01 }, key: 'billing.errors.amountTooLarge' },
    { input: { label: 'Deposit', amount: 100, description: 'y'.repeat(2001) }, key: 'billing.errors.descriptionTooLong' },
  ];
  for (const { input, key } of cases) {
    const res = validateMilestoneInput(input);
    assert.equal(res.ok, false, `expected rejection for ${JSON.stringify(input)}`);
    assert.equal(!res.ok && res.errorKey, key, `wrong key for ${JSON.stringify(input)}`);
  }

  // Boundary: exactly 80 chars and exactly $1,000,000 are fine.
  const okEdge = validateMilestoneInput({
    label: 'x'.repeat(80),
    amount: 1_000_000,
    description: 'y'.repeat(2000),
  });
  assert.equal(okEdge.ok, true);
});

test('excludeInvoicedJobs drops jobs that already have an invoice', () => {
  const jobs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const out = excludeInvoicedJobs(jobs, [
    { jobId: 'b' },
    { jobId: null }, // legacy invoices with no job link: ignored
    { jobId: 'zzz' }, // invoice for a job not in this set: ignored
  ]);
  assert.deepEqual(out, [{ id: 'a' }, { id: 'c' }]);
  assert.deepEqual(excludeInvoicedJobs(jobs, []), jobs);
});

/** Every billing string must exist in fr and be a non-empty string. */
function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...leafPaths(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

test('billing fragment has full en/fr parity', () => {
  const enPaths = leafPaths(fragment.en.billing as unknown as Record<string, unknown>);
  assert.ok(enPaths.length > 20, `expected many billing keys, got ${enPaths.length}`);
  const missing = enPaths.filter(
    (p) =>
      typeof getPath(fragment.fr.billing as unknown as Record<string, unknown>, p) !== 'string' ||
      String(getPath(fragment.fr.billing as unknown as Record<string, unknown>, p)).trim() === ''
  );
  assert.deepEqual(missing, [], `missing/empty fr keys: ${missing.join(', ')}`);

  // No orphan fr keys either.
  const frPaths = leafPaths(fragment.fr.billing as unknown as Record<string, unknown>);
  const orphans = frPaths.filter(
    (p) => typeof getPath(fragment.en.billing as unknown as Record<string, unknown>, p) !== 'string'
  );
  assert.deepEqual(orphans, []);
});

test('validation error keys resolve to real en/fr strings in the fragment', () => {
  const keys = [
    'labelRequired',
    'labelTooLong',
    'amountInvalid',
    'amountTooSmall',
    'amountTooLarge',
    'descriptionTooLong',
  ];
  for (const k of keys) {
    const en = (fragment.en.billing as { errors: Record<string, string> }).errors[k];
    const fr = (fragment.fr.billing as { errors: Record<string, string> }).errors[k];
    assert.ok(en && typeof en === 'string' && en.length > 0, `en ${k}`);
    assert.ok(fr && typeof fr === 'string' && fr.length > 0, `fr ${k}`);
    assert.notEqual(en, fr, `${k} should be translated, not copied`);
  }
});
