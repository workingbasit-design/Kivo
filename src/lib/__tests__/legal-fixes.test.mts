/**
 * Tests for the reel-driven legal fixes:
 * 1. Age requirement moved to Terms of Service (18+ clause in legal.ts);
 *    the signup form no longer has an age checkbox — registration succeeds
 *    without ageConfirm, and the register page links Terms + Privacy.
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

test('registerSchema accepts signup without an age confirmation field', () => {
  const r = registerSchema.safeParse({ ...BASE });
  assert.ok(r.success);
});

test('registerSchema ignores a stray ageConfirm value', () => {
  const r = registerSchema.safeParse({ ...BASE, ageConfirm: 'on' });
  assert.ok(r.success);
});

test('terms of service require users to be 18 or older (EN + FR)', async () => {
  const { TERMS } = await import('../legal.ts');
  const enBody = TERMS.en.sections.map((s) => s.body.join(' ')).join(' ');
  const frBody = TERMS.fr.sections.map((s) => s.body.join(' ')).join(' ');
  assert.match(enBody, /18 or older/);
  assert.match(frBody, /18 ans ou plus/);
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
