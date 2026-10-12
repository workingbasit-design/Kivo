/**
 * Unit tests for general expense tracking: pure helpers in
 * src/lib/expenses.ts plus en/fr parity of the expenses i18n fragment.
 * No HTTP, no DB — pure logic only.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/expenses.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPENSE_CATEGORIES,
  isExpenseCategory,
  validateExpenseForm,
  buildExpenseReceiptPathname,
  isReceiptMime,
  parseExpenseFilters,
} from '@/lib/expenses.ts';
import fragment from '../i18n/fragments/expenses.ts';

test('category allowlist accepts MATERIALS/TRAVEL/OTHER, rejects everything else', () => {
  for (const ok of EXPENSE_CATEGORIES) assert.equal(isExpenseCategory(ok), true, ok);
  for (const bad of ['', 'LABOR', 'materials', 'FOOD', 'MATERIALS ']) {
    assert.equal(isExpenseCategory(bad), false, JSON.stringify(bad));
  }
});

test('validateExpenseForm accepts a complete valid form', () => {
  const res = validateExpenseForm({
    description: 'Copper pipe',
    amount: '42.50',
    category: 'materials',
    spentAt: '2026-10-12',
    jobId: '',
    note: 'extra note',
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.description, 'Copper pipe');
    assert.equal(res.data.amount, 42.5);
    assert.equal(res.data.category, 'MATERIALS');
    assert.equal(res.data.spentAt, '2026-10-12');
  }
});

test('validateExpenseForm rejects bad input with i18n error keys', () => {
  assert.deepEqual(validateExpenseForm({ description: '', amount: '5', category: 'MATERIALS', spentAt: '2026-10-12' }), {
    ok: false,
    error: 'errors.expenseDescriptionRequired',
  });
  const zero = validateExpenseForm({ description: 'x', amount: '0', category: 'MATERIALS', spentAt: '2026-10-12' });
  assert.equal(zero.ok, false);
  if (!zero.ok) assert.equal(zero.error, 'errors.expenseAmountInvalid');
  const badCat = validateExpenseForm({ description: 'x', amount: '5', category: 'FOOD', spentAt: '2026-10-12' });
  assert.equal(badCat.ok, false);
  if (!badCat.ok) assert.equal(badCat.error, 'errors.expenseCategoryInvalid');
  const badDate = validateExpenseForm({ description: 'x', amount: '5', category: 'OTHER', spentAt: '2026-13-99' });
  assert.equal(badDate.ok, false);
  if (!badDate.ok) assert.equal(badDate.error, 'errors.expenseDateInvalid');
});

test('buildExpenseReceiptPathname sanitizes hostile input', () => {
  const p = buildExpenseReceiptPathname({
    businessId: 'biz_123',
    uid: 'abc123',
    fileName: '../../etc/passwd.png',
  });
  assert.ok(p.startsWith('attachments/biz123/expense/abc123-'), p);
  assert.ok(!p.includes('..'));
  assert.ok(p.endsWith('.png'));
});

test('isReceiptMime accepts photos only', () => {
  for (const ok of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
    assert.equal(isReceiptMime(ok), true, ok);
  }
  for (const bad of ['application/pdf', 'text/csv', 'image/gif', '']) {
    assert.equal(isReceiptMime(bad), false, JSON.stringify(bad));
  }
});

test('parseExpenseFilters normalizes query params', () => {
  assert.deepEqual(parseExpenseFilters({}), {
    category: 'ALL',
    jobId: 'ALL',
    from: '',
    to: '',
    q: '',
  });
  const f = parseExpenseFilters({
    category: 'travel',
    jobId: 'job_1',
    from: '2026-01-01',
    to: 'not-a-date',
    q: '  pipe  ',
  });
  assert.equal(f.category, 'TRAVEL');
  assert.equal(f.jobId, 'job_1');
  assert.equal(f.from, '2026-01-01');
  assert.equal(f.to, '');
  assert.equal(f.q, 'pipe');
});

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...collectKeys(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out.sort();
}

test('expenses fragment has en/fr parity', () => {
  const enKeys = collectKeys((fragment as { en: Record<string, unknown> }).en);
  const frKeys = collectKeys((fragment as { fr: Record<string, unknown> }).fr);
  assert.deepEqual(frKeys, enKeys);
  assert.ok(enKeys.length > 30, `expected many keys, got ${enKeys.length}`);
});
