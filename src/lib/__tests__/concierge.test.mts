/**
 * Tests for src/lib/concierge.ts — the "Get it done for me" pure logic.
 * Interpretation, message building, and idempotency-key validation.
 * No DB, no network.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/concierge.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretServiceNeed,
  buildConciergeMessage,
  isValidIdempotencyKey,
  serviceHintKeywords,
  CONCIERGE_MAX_PROS,
  CONCIERGE_RATE_LIMIT,
} from '@/lib/concierge.ts';

test('constants: at most 3 pros, rate-limited sends', () => {
  assert.equal(CONCIERGE_MAX_PROS, 3);
  assert.equal(CONCIERGE_RATE_LIMIT.limit, 5);
});

test('interpretServiceNeed: English plumbing description', () => {
  const r = interpretServiceNeed('Kitchen faucet is leaking badly, dripping all night.');
  assert.equal(r.key, 'plumbing');
  assert.equal(r.label, 'Plumbing');
});

test('interpretServiceNeed: French plumbing description', () => {
  const r = interpretServiceNeed('Mon robinet fuit depuis hier soir.', 'fr');
  assert.equal(r.key, 'plumbing');
  assert.equal(r.label, 'Plomberie');
});

test('interpretServiceNeed: electrical, HVAC, cleaning', () => {
  assert.equal(interpretServiceNeed('The breaker keeps tripping.').key, 'electrical');
  assert.equal(interpretServiceNeed('La fournaise ne chauffe plus.', 'fr').key, 'hvac');
  assert.equal(interpretServiceNeed('Need a deep clean before moving out.').key, 'cleaning');
});

test('interpretServiceNeed: mixed services resolve to the first match', () => {
  // "fix my sink and the light" — plumbing hint comes first in the table.
  const r = interpretServiceNeed('fix my sink and the light in the hallway');
  assert.equal(r.key, 'plumbing');
});

test('interpretServiceNeed: unknown description falls back to general', () => {
  const r = interpretServiceNeed('I need someone to look at a weird thing in my basement.');
  assert.equal(r.key, 'general');
  assert.equal(r.label, 'Home service');
  assert.ok(r.matchKeyword.length > 0, 'falls back to the raw description for matching');
  const fr = interpretServiceNeed('Quelque chose d’étrange au sous-sol.', 'fr');
  assert.equal(fr.key, 'general');
  assert.equal(fr.label, 'Service à domicile');
});

test('buildConciergeMessage: exact English message', () => {
  const msg = buildConciergeMessage({
    serviceLabel: 'Plumbing',
    description: 'Kitchen faucet is leaking badly.',
    name: 'Alex Carter',
    phone: '(416) 555-0132',
    city: 'Toronto',
    locale: 'en',
  });
  assert.ok(msg.startsWith('Quote request — Plumbing'), 'service label in header');
  assert.ok(msg.includes('Kitchen faucet is leaking badly.'), 'description included verbatim');
  assert.ok(msg.includes('Name: Alex Carter'), 'name included');
  assert.ok(msg.includes('Phone: (416) 555-0132'), 'phone included');
  assert.ok(msg.includes('City: Toronto'), 'city included');
  assert.ok(msg.includes('EveryJob'), 'EveryJob attribution present');
});

test('buildConciergeMessage: French message uses French labels', () => {
  const msg = buildConciergeMessage({
    serviceLabel: 'Plomberie',
    description: 'Mon robinet fuit.',
    name: 'Alex Carter',
    phone: '(416) 555-0132',
    city: 'Toronto',
    locale: 'fr',
  });
  assert.ok(msg.startsWith('Demande de devis — Plomberie'));
  assert.ok(msg.includes('Nom : Alex Carter'));
  assert.ok(msg.includes('Téléphone : (416) 555-0132'));
  assert.ok(msg.includes('Ville : Toronto'));
});

test('buildConciergeMessage: preview text and sent text are the same builder', () => {
  const input = {
    serviceLabel: 'Plumbing',
    description: '  Leaky faucet.  ',
    name: ' Alex ',
    phone: '4165550132',
    city: 'Toronto',
    locale: 'en' as const,
  };
  // Called twice (preview, then send) — output must be identical.
  assert.equal(buildConciergeMessage(input), buildConciergeMessage(input));
});

test('isValidIdempotencyKey: accepts UUID-like keys, rejects junk', () => {
  assert.equal(isValidIdempotencyKey('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isValidIdempotencyKey('abc123_-XYZ'), true);
  assert.equal(isValidIdempotencyKey(''), false);
  assert.equal(isValidIdempotencyKey('short'), false);
  assert.equal(isValidIdempotencyKey('has spaces in it 12345678'), false);
  assert.equal(isValidIdempotencyKey('x'.repeat(129)), false);
  assert.equal(isValidIdempotencyKey('drop-table;--1234567890'), false);
});

test('serviceHintKeywords: D1 regression — "leaky faucet repair" resolves to plumbing keywords that match a plumbing business', () => {
  // Customer-POV E2E D1: the public /directory/request form lost this lead
  // because every-word literal matching failed. The directory now interprets
  // the need first; lock the mapping this depends on.
  const need = interpretServiceNeed('leaky faucet repair', 'en');
  assert.equal(need.key, 'plumbing');
  const keywords = serviceHintKeywords('plumbing');
  assert.ok(keywords.includes('faucet'), 'plumbing keywords include "faucet"');
  const hay = 'maple leaf plumbing plumbing drain cleaning';
  assert.ok(
    keywords.some((k) => hay.includes(k)),
    'at least one plumbing keyword matches the business name/services'
  );
});

test('serviceHintKeywords: unknown key returns empty (falls back to literal matching)', () => {
  assert.deepEqual(serviceHintKeywords('not-a-trade'), []);
  assert.equal(interpretServiceNeed('xyzzy frobnicate the wobble', 'en').key, 'general');
});
