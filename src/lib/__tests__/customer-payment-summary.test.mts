/**
 * Regression tests (2026-11-17, Customers redesign): the shared
 * getCustomerPaymentSummary helper must report a customer's real payment
 * position — balance due across unpaid invoices minus completed partial
 * payments, last payment, lifetime paid total — and must never count
 * voided invoices, voided payments, or other businesses' records.
 *
 * The helper feeds both the invoice-form auto-fetch endpoint and the
 * customer detail page; these tests pin the numbers so the two surfaces
 * can never disagree.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *   src/lib/__tests__/customer-payment-summary.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { getCustomerPaymentSummary } = await import(
  '@/lib/customer-payment-summary.ts'
);

type InvoiceRow = {
  id: string;
  number: string;
  totalCents: bigint;
  dueAt: Date | null;
  date: Date;
  businessId: string;
  customerId: string;
  status: string;
  voidedAt: Date | null;
};

type PaymentRow = {
  id: string;
  invoiceId: string;
  amountCents: bigint;
  createdAt: Date;
  provider: string | null;
  businessId: string;
  status: string;
  voidedAt: Date | null;
};

function makeDb(invoices: InvoiceRow[], payments: PaymentRow[]) {
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  return {
    invoice: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const statusIn = (where.status as { in: string[] }).in;
        return invoices
          .filter((i) => i.businessId === where.businessId)
          .filter((i) => i.customerId === where.customerId)
          .filter((i) => (where.voidedAt === null ? i.voidedAt === null : true))
          .filter((i) => statusIn.includes(i.status))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((i) => ({
            id: i.id,
            number: i.number,
            totalCents: i.totalCents,
            dueAt: i.dueAt,
          }));
      },
    },
    payment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const ids = (where.invoiceId as { in: string[] }).in;
        return payments
          .filter((p) => p.businessId === where.businessId)
          .filter((p) => ids.includes(p.invoiceId))
          .filter((p) => p.status === where.status)
          .filter((p) => (where.voidedAt === null ? p.voidedAt === null : true))
          .map((p) => ({ invoiceId: p.invoiceId, amountCents: p.amountCents }));
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const customerId = (where.invoice as { customerId: string }).customerId;
        const rows = payments
          .filter((p) => p.businessId === where.businessId)
          .filter((p) => p.status === where.status)
          .filter((p) => (where.voidedAt === null ? p.voidedAt === null : true))
          .filter((p) => invoiceById.get(p.invoiceId)?.customerId === customerId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const first = rows[0];
        return first
          ? {
              amountCents: first.amountCents,
              createdAt: first.createdAt,
              provider: first.provider,
            }
          : null;
      },
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const customerId = (where.invoice as { customerId: string }).customerId;
        const sum = payments
          .filter((p) => p.businessId === where.businessId)
          .filter((p) => p.status === where.status)
          .filter((p) => (where.voidedAt === null ? p.voidedAt === null : true))
          .filter((p) => invoiceById.get(p.invoiceId)?.customerId === customerId)
          .reduce((s, p) => s + Number(p.amountCents), 0);
        return { _sum: { amountCents: BigInt(sum) } };
      },
    },
  };
}

const INV = (
  overrides: Partial<InvoiceRow> & { id: string },
): InvoiceRow => ({
  number: 'INV-1',
  totalCents: 10000n,
  dueAt: null,
  date: new Date('2026-11-01T00:00:00Z'),
  businessId: 'biz-1',
  customerId: 'cus-1',
  status: 'UNPAID',
  voidedAt: null,
  ...overrides,
});

const PAY = (
  overrides: Partial<PaymentRow> & { id: string; invoiceId: string },
): PaymentRow => ({
  amountCents: 4000n,
  createdAt: new Date('2026-11-05T00:00:00Z'),
  provider: 'cash',
  businessId: 'biz-1',
  status: 'COMPLETED',
  voidedAt: null,
  ...overrides,
});

test('balance due subtracts completed partial payments from unpaid invoices', async () => {
  const db = makeDb(
    [INV({ id: 'inv-1', number: 'INV-0001', totalCents: 10000n })],
    [PAY({ id: 'pay-1', invoiceId: 'inv-1', amountCents: 4000n })],
  );
  const s = await getCustomerPaymentSummary(db as never, 'biz-1', 'cus-1', 'Cust One');
  assert.equal(s.balanceDueCents, 6000);
  assert.equal(s.unpaidCount, 1);
  assert.equal(s.unpaid[0].balanceCents, 6000);
  assert.equal(s.totalPaidCents, 4000);
  assert.equal(s.lastPayment?.amountCents, 4000);
});

test('fully paid and voided invoices are excluded from the balance', async () => {
  const db = makeDb(
    [
      INV({ id: 'inv-1', number: 'INV-0001', totalCents: 10000n }),
      INV({ id: 'inv-2', number: 'INV-0002', totalCents: 5000n, voidedAt: new Date() }),
      INV({ id: 'inv-3', number: 'INV-0003', totalCents: 7000n, status: 'PAID' }),
    ],
    [PAY({ id: 'pay-1', invoiceId: 'inv-1', amountCents: 10000n })],
  );
  const s = await getCustomerPaymentSummary(db as never, 'biz-1', 'cus-1', 'Cust One');
  assert.equal(s.balanceDueCents, 0);
  assert.equal(s.unpaidCount, 0);
  assert.deepEqual(s.unpaid, []);
});

test('voided and non-completed payments never reduce the balance', async () => {
  const db = makeDb(
    [INV({ id: 'inv-1', number: 'INV-0001', totalCents: 10000n })],
    [
      PAY({ id: 'pay-1', invoiceId: 'inv-1', amountCents: 4000n, voidedAt: new Date() }),
      PAY({ id: 'pay-2', invoiceId: 'inv-1', amountCents: 3000n, status: 'PENDING' }),
    ],
  );
  const s = await getCustomerPaymentSummary(db as never, 'biz-1', 'cus-1', 'Cust One');
  assert.equal(s.balanceDueCents, 10000);
  assert.equal(s.totalPaidCents, 0);
  assert.equal(s.lastPayment, null);
});

test('other businesses records are never counted', async () => {
  const db = makeDb(
    [
      INV({ id: 'inv-1', number: 'INV-0001', totalCents: 10000n }),
      INV({ id: 'inv-9', number: 'INV-0009', totalCents: 99900n, businessId: 'biz-2' }),
    ],
    [PAY({ id: 'pay-9', invoiceId: 'inv-9', amountCents: 99900n, businessId: 'biz-2' })],
  );
  const s = await getCustomerPaymentSummary(db as never, 'biz-1', 'cus-1', 'Cust One');
  assert.equal(s.balanceDueCents, 10000);
  assert.equal(s.totalPaidCents, 0);
});

test('a customer with no invoices reports zeros', async () => {
  const db = makeDb([], []);
  const s = await getCustomerPaymentSummary(db as never, 'biz-1', 'cus-1', 'Cust One');
  assert.equal(s.balanceDueCents, 0);
  assert.equal(s.unpaidCount, 0);
  assert.equal(s.totalPaidCents, 0);
  assert.equal(s.lastPayment, null);
});
