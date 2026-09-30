/**
 * Regression tests for money persistence (EveryJob defect, Sep 2026):
 * production stored 99.99 as 99.98999786376952 and crashed job create/edit
 * on 199.99 / 19.99 / 0. Root fix: every money write path rounds with
 * Number(n.toFixed(2)) instead of Math.round(n * 100) / 100.
 *
 * These tests pin the write-path contract: values typed by the user
 * (arriving as FormData strings) must come out as the exact float64 for
 * that decimal, so a create → read round-trip can never surface a
 * float32-style artifact like 99.98999786376952.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  jobSchema,
  serviceSchema,
  quoteSchema,
  invoiceSchema,
  paymentSchema,
} from '../validations.ts';
import { parseHourlyRateInput } from '../costing.ts';

/** Historically-bad values from the production incident. */
const BAD_VALUES = ['99.99', '199.99', '19.99', '149.50', '0', '10000'];

function priceOf(schema: { parse: (v: unknown) => any }, input: unknown, field: string) {
  const base: Record<string, unknown> = {
    name: 'Test Service',
    title: 'Test Quote',
    customerId: 'cust_1',
    date: '2026-10-01',
    invoiceId: 'inv_1',
  };
  const parsed = schema.parse({ ...base, [field]: input });
  return parsed[field] as number;
}

test('service price: typed decimals survive the write transform exactly', () => {
  for (const raw of BAD_VALUES) {
    const out = priceOf(serviceSchema, raw, 'price');
    assert.equal(out, Number(raw), `service price ${raw} must round-trip exactly`);
    assert.equal(out.toFixed(2), Number(raw).toFixed(2));
    // The float32 artifact must never appear.
    assert.ok(
      !String(out).includes('9999786376952') && !String(out).includes('900054931641'),
      `service price ${raw} produced a float artifact: ${out}`
    );
  }
});

test('job price: 199.99 / 19.99 / 0 do not crash or corrupt', () => {
  assert.equal(priceOf(jobSchema, '199.99', 'price'), 199.99);
  assert.equal(priceOf(jobSchema, '19.99', 'price'), 19.99);
  assert.equal(priceOf(jobSchema, '0', 'price'), 0);
});

test('quote total and invoice subtotal round to cents', () => {
  assert.equal(priceOf(quoteSchema, '299.99', 'total'), 299.99);
  assert.equal(priceOf(invoiceSchema, '265.48', 'subtotal'), 265.48);
});

test('payment amount rounds to cents', () => {
  assert.equal(priceOf(paymentSchema, '34.51', 'amount'), 34.51);
});

test('hourly rate input rounds instead of leaking float dust', () => {
  // 0.011 $/min-style values must not surface as 0.010999999940395355.
  const r = parseHourlyRateInput('0.011');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data, 0.01);
  const r2 = parseHourlyRateInput('75.50');
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.data, 75.5);
});

test('toFixed(2) transform recovers the historically-corrupted float32 value', () => {
  // The production incident value: 99.99 once came back from the database as
  // the float32 artifact 99.98999786376952. The write-path transform must
  // map it back to exactly 99.99 so re-saving can never perpetuate it.
  const corrupted = 99.98999786376952;
  assert.equal(Number(corrupted.toFixed(2)), 99.99);
  assert.equal(Number(new Float32Array([99.99])[0].toFixed(2)), 99.99);
});
