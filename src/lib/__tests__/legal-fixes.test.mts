/**
 * Tests for the reel-driven legal fixes:
 * 1. Age gate on signup (registerSchema requires ageConfirm="on").
 * 2. Transactional email footer (no-marketing statement in HTML + text).
 *
 * Run: node --test src/lib/__tests__/legal-fixes.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '../validations.ts';
import {
  welcomeEmail,
  passwordResetEmail,
  quoteEmail,
  invoiceEmail,
} from '../messaging/email-templates.ts';

const BASE = {
  name: 'Sarah Miller',
  businessName: 'Maple Leaf Plumbing',
  email: 'sarah@mapleleaf.ca',
  password: 'Passw0rd1',
};

test('registerSchema accepts a checked age confirmation', () => {
  const r = registerSchema.safeParse({ ...BASE, ageConfirm: 'on' });
  assert.ok(r.success);
});

test('registerSchema rejects a missing age confirmation', () => {
  const r = registerSchema.safeParse({ ...BASE, ageConfirm: null });
  assert.ok(!r.success);
  assert.match(r.error.issues[0]?.message ?? '', /18 or older/);
});

test('registerSchema rejects an empty age confirmation', () => {
  const r = registerSchema.safeParse({ ...BASE, ageConfirm: '' });
  assert.ok(!r.success);
});

test('every email template carries the no-marketing footer (HTML + text)', () => {
  const templates = [
    welcomeEmail('Sarah', 'Maple Leaf Plumbing'),
    passwordResetEmail('Sarah', 'https://example.com/reset'),
    quoteEmail({
      customerName: 'Bob',
      businessName: 'Maple Leaf Plumbing',
      quoteNumber: 'Q-1',
      quoteTitle: 'Faucet repair',
      total: '$100.00',
      link: 'https://example.com/q/1',
    }),
    invoiceEmail({
      customerName: 'Bob',
      businessName: 'Maple Leaf Plumbing',
      invoiceNumber: 'INV-1',
      total: '$100.00',
      link: 'https://example.com/i/1',
    }),
  ];
  for (const t of templates) {
    assert.match(t.html, /never sends marketing email/i, 'HTML footer missing');
    assert.match(t.text, /never sends marketing email/i, 'text footer missing');
    assert.match(t.text, /compte EveryJob/i, 'French text footer missing');
  }
});
