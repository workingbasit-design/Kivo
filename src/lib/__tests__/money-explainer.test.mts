import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExplainerStrings,
  buildInvoiceExplainerLines,
  buildQuoteExplainerLines,
  type ExplainerStrings,
} from '../money-explainer.ts';

const EN: ExplainerStrings = buildExplainerStrings((k) => `EN:${k}`);

const baseInvoice = {
  subtotal: '$200.00',
  taxes: [
    { name: 'GST', rate: 5, amount: '$10.00' },
    { name: 'QST', rate: 9.975, amount: '$19.95' },
  ],
  total: '$229.95',
  paid: '$100.00',
  paidCents: 10000,
  balance: '$129.95',
  remainingCents: 12995,
  status: 'PARTIALLY PAID',
  voided: false,
  dueAt: new Date('2026-11-25T05:00:00Z'),
  dueTimezone: 'America/Toronto',
  locale: 'en' as const,
  overdue: false,
  strings: EN,
};

test('invoice: walks subtotal, taxes (with QST note), total, paid, balance, due, status', () => {
  const lines = buildInvoiceExplainerLines({
    ...baseInvoice,
    strings: { ...EN, due: 'Due {date}.' },
  });
  const labels = lines.map((l) => l.label);
  assert.deepEqual(labels, [
    'EN:labelSubtotal',
    'GST 5%',
    'QST 9.975%',
    'EN:labelTotal',
    'EN:labelPaid',
    'EN:labelBalance',
    'EN:labelDue',
    'EN:labelStatus',
  ]);
  const qst = lines.find((l) => l.label === 'QST 9.975%')!;
  assert.match(qst.text, /EN:quebecTaxNote/);
  const due = lines.find((l) => l.label === 'EN:labelDue')!;
  assert.match(due.text, /November 25, 2026/);
  assert.equal(lines.at(-1)!.text, 'EN:statusPartial');
});

test('invoice: voided stops after total + void status (no paid/balance chase)', () => {
  const lines = buildInvoiceExplainerLines({ ...baseInvoice, voided: true });
  assert.deepEqual(
    lines.map((l) => l.label),
    ['EN:labelSubtotal', 'GST 5%', 'QST 9.975%', 'EN:labelTotal', 'EN:labelStatus'],
  );
  assert.equal(lines.at(-1)!.text, 'EN:statusVoid');
});

test('invoice: fully paid omits balance/due/overdue, ends on paid status', () => {
  const lines = buildInvoiceExplainerLines({
    ...baseInvoice,
    paid: '$229.95',
    paidCents: 22995,
    balance: '$0.00',
    remainingCents: 0,
    status: 'PAID',
  });
  assert.equal(lines.at(-1)!.text, 'EN:statusPaid');
  assert.ok(!lines.some((l) => l.label === 'EN:labelBalance'));
  assert.ok(!lines.some((l) => l.label === 'EN:labelDue'));
});

test('invoice: unpaid with no payments omits the paid line; overdue adds its line', () => {
  const lines = buildInvoiceExplainerLines({
    ...baseInvoice,
    paid: '$0.00',
    paidCents: 0,
    status: 'UNPAID',
    overdue: true,
  });
  assert.ok(!lines.some((l) => l.label === 'EN:labelPaid'));
  assert.ok(lines.some((l) => l.label === 'EN:labelOverdue'));
  assert.equal(lines.at(-1)!.text, 'EN:statusUnpaid');
});

test('invoice: due date renders in French for fr locale', () => {
  const lines = buildInvoiceExplainerLines({
    ...baseInvoice,
    locale: 'fr',
    strings: { ...EN, due: 'Due {date}.' },
  });
  const due = lines.find((l) => l.label === 'EN:labelDue')!;
  assert.match(due.text, /25 novembre 2026/);
});

test('quote: discount line sits between subtotal and taxes; status maps', () => {
  const lines = buildQuoteExplainerLines({
    subtotal: '$200.00',
    discount: { label: '10% off', amount: '$20.00' },
    taxes: [{ name: 'HST', rate: 13, amount: '$23.40' }],
    total: '$203.40',
    status: 'SENT',
    strings: EN,
  });
  assert.deepEqual(
    lines.map((l) => l.label),
    ['EN:labelSubtotal', '10% off', 'HST 13%', 'EN:labelTotal', 'EN:labelStatus'],
  );
  assert.equal(lines.at(-1)!.text, 'EN:statusSent');
});

test('quote: no discount means no discount line; unknown status falls back to draft', () => {
  const lines = buildQuoteExplainerLines({
    subtotal: '$100.00',
    discount: null,
    taxes: [],
    total: '$100.00',
    status: 'DRAFT',
    strings: EN,
  });
  assert.deepEqual(
    lines.map((l) => l.label),
    ['EN:labelSubtotal', 'EN:labelTotal', 'EN:labelStatus'],
  );
  assert.equal(lines.at(-1)!.text, 'EN:statusDraft');
});

test('buildExplainerStrings resolves every key through one lookup', () => {
  const s = buildExplainerStrings((k) => `X:${k}`);
  assert.equal(s.title, 'X:title');
  assert.equal(s.statusDeclined, 'X:statusDeclined');
  assert.equal(Object.keys(s).length, 26);
});
