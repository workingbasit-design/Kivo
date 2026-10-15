/**
 * P4-U-023 — Every zod input schema: valid and invalid examples.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerSchema,
  jobSchema,
  serviceSchema,
  quoteSchema,
  invoiceSchema,
  paymentSchema,
  leadSchema,
  businessSchema,
  recurringSchema,
  registerSchema,
  loginSchema,
} from '../validations.ts';

const okCustomer = { name: 'Alice Tremblay', phone: '5145551234', email: 'a@example.ca' };

test('P4-U-023: customerSchema accepts valid, rejects bad', () => {
  assert.ok(customerSchema.safeParse(okCustomer).success);
  assert.ok(!customerSchema.safeParse({ ...okCustomer, name: 'A' }).success, 'name too short');
  assert.ok(!customerSchema.safeParse({ ...okCustomer, email: 'not-an-email' }).success);
  const trimmed = customerSchema.parse({ ...okCustomer, name: '  Alice  ' });
  assert.equal(trimmed.name, 'Alice');
});

test('P4-U-023: jobSchema accepts valid, rejects bad', () => {
  const ok = { title: 'Fix sink', customerId: 'c1', date: '2026-10-20', price: 150 };
  assert.ok(jobSchema.safeParse(ok).success);
  assert.ok(!jobSchema.safeParse({ ...ok, title: '' }).success, 'title required');
  assert.ok(!jobSchema.safeParse({ ...ok, customerId: '' }).success, 'customer required');
  assert.ok(!jobSchema.safeParse({ ...ok, date: '20/10/2026' }).success, 'date format');
  assert.ok(!jobSchema.safeParse({ ...ok, price: -5 }).success, 'negative price');
  const zero = jobSchema.parse({ ...ok, price: 0 });
  assert.equal(zero.price, 0, '$0 jobs are allowed by schema (UI warns)');
  const rounded = jobSchema.parse({ ...ok, price: 19.999 });
  assert.equal(rounded.price, 20, 'price rounds to cents');
});

test('P4-U-023: serviceSchema accepts valid, rejects bad', () => {
  assert.ok(serviceSchema.safeParse({ name: 'Drain cleaning', price: 99.99 }).success);
  assert.ok(!serviceSchema.safeParse({ name: 'X', price: 10 }).success);
  assert.ok(!serviceSchema.safeParse({ name: 'Drain', price: -1 }).success);
});

test('P4-U-023: quoteSchema accepts valid, rejects bad', () => {
  const ok = { title: 'Bathroom reno', customerId: 'c1', total: 5000 };
  assert.ok(quoteSchema.safeParse(ok).success);
  assert.ok(!quoteSchema.safeParse({ ...ok, total: -100 }).success);
  assert.ok(!quoteSchema.safeParse({ ...ok, status: 'BOGUS' }).success);
});

test('P4-U-023: invoiceSchema accepts valid, rejects bad', () => {
  const ok = { customerId: 'c1', date: '2026-10-20', subtotal: 200 };
  assert.ok(invoiceSchema.safeParse(ok).success);
  assert.ok(!invoiceSchema.safeParse({ ...ok, date: 'yesterday' }).success);
  assert.ok(!invoiceSchema.safeParse({ ...ok, taxRate: 101 }).success, 'tax rate <= 100');
});

test('P4-U-023: paymentSchema requires positive amount', () => {
  const ok = { invoiceId: 'i1', amount: 250.5 };
  const parsed = paymentSchema.safeParse(ok);
  assert.ok(parsed.success);
  assert.ok(!paymentSchema.safeParse({ ...ok, amount: 0 }).success, 'zero rejected');
  assert.ok(!paymentSchema.safeParse({ ...ok, amount: -10 }).success, 'negative rejected');
  assert.ok(!paymentSchema.safeParse({ ...ok, provider: 'BITCOIN' }).success);
});

test('P4-U-023: leadSchema accepts valid, rejects bad', () => {
  assert.ok(leadSchema.safeParse({ name: 'Bob Singh', phone: '6135559876' }).success);
  assert.ok(!leadSchema.safeParse({ name: '', phone: '6135559876' }).success);
  assert.ok(!leadSchema.safeParse({ name: 'Bob', email: 'bad' }).success);
});

test('P4-U-023: businessSchema accepts valid, rejects bad', () => {
  assert.ok(businessSchema.safeParse({ name: 'Maple Leaf Plumbing' }).success);
  assert.ok(!businessSchema.safeParse({ name: 'A' }).success);
});

test('P4-U-023: recurringSchema accepts valid, rejects bad', () => {
  const ok = { title: 'Monthly check', customerId: 'c1', frequency: 'MONTHLY', startDate: '2026-11-01', price: 80 };
  assert.ok(recurringSchema.safeParse(ok).success);
  assert.ok(!recurringSchema.safeParse({ ...ok, frequency: 'YEARLY2' }).success);
});

test('P4-U-023: registerSchema enforces strong passwords; loginSchema is lenient', () => {
  const ok = { name: 'Basit', businessName: 'Lion calulator', email: 'a@b.ca', password: 'LongEnough12345' };
  assert.ok(registerSchema.safeParse(ok).success);
  assert.ok(!registerSchema.safeParse({ ...ok, password: 'short1' }).success, 'min length');
  assert.ok(
    !registerSchema.safeParse({ ...ok, password: 'longbutnodigits!!' }).success,
    'needs letter+digit',
  );
  assert.ok(!registerSchema.safeParse({ ...ok, email: 'bad' }).success);
  assert.ok(!registerSchema.safeParse({ email: 'a@b.ca', password: 'LongEnough12345' }).success, 'name+business required');
  // Login must not leak password rules (generic error surface).
  assert.ok(loginSchema.safeParse({ email: 'a@b.ca', password: 'x' }).success);
});
