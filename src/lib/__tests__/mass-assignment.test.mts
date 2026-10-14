/**
 * B1.3 mass-assignment tests: hostile fields (businessId, role, ownerId,
 * status, totals) smuggled into action payloads must be stripped by the
 * zod schemas and never reach the database layer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const validations = await import('../validations.ts');

describe('B1.3 mass assignment', () => {
  it('invoiceSchema strips businessId/role/status/totals', () => {
    const parsed = validations.invoiceSchema.safeParse({
      customerId: 'cust-1',
      date: '2026-10-14',
      subtotal: 100,
      taxRate: 5,
      // Hostile extras:
      businessId: 'biz-evil',
      role: 'OWNER',
      ownerId: 'user-evil',
      status: 'PAID',
      totalCents: 999999,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal('businessId' in parsed.data, false);
      assert.equal('role' in parsed.data, false);
      assert.equal('ownerId' in parsed.data, false);
      assert.equal('status' in parsed.data, false);
      assert.equal('totalCents' in parsed.data, false);
      // Legit fields survive:
      assert.equal(parsed.data.customerId, 'cust-1');
    }
  });

  it('paymentSchema strips businessId and invoice-status overrides', () => {
    const parsed = validations.paymentSchema.safeParse({
      invoiceId: 'inv-1',
      amount: 50,
      provider: 'CASH',
      businessId: 'biz-evil',
      status: 'COMPLETED',
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal('businessId' in parsed.data, false);
      assert.equal('status' in parsed.data, false);
    }
  });

  it('registerSchema strips role/businessId (no self-promotion to OWNER)', () => {
    const parsed = validations.registerSchema.safeParse({
      name: 'Eve',
      businessName: 'Evil Corp',
      email: 'eve@example.ca',
      password: 'correct-horse-battery-staple-1',
      role: 'OWNER',
      businessId: 'biz-evil',
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal('role' in parsed.data, false);
      assert.equal('businessId' in parsed.data, false);
    }
  });
});
