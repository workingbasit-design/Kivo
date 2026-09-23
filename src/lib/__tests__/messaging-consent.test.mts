/**
 * Unit tests for CASL consent guardrails and inbound STOP/HELP
 * detection (src/lib/messaging/consent.ts).
 * Run: node --test src/lib/__tests__/messaging-consent.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSendMessage,
  normalizeInboundText,
  isStopText,
  isHelpText,
} from '../messaging/consent.ts';

/* ---------------- canSendMessage ---------------- */

test('canSendMessage is true only with consent === true and a contact', () => {
  assert.equal(canSendMessage({ consent: true, channel: 'WHATSAPP', hasContact: true }), true);
  assert.equal(canSendMessage({ consent: true, channel: 'EMAIL', hasContact: true }), true);
});

test('canSendMessage fails closed without explicit true consent', () => {
  assert.equal(canSendMessage({ consent: false, channel: 'WHATSAPP', hasContact: true }), false);
  assert.equal(canSendMessage({ consent: null, channel: 'WHATSAPP', hasContact: true }), false);
  assert.equal(canSendMessage({ consent: undefined, channel: 'WHATSAPP', hasContact: true }), false);
  assert.equal(canSendMessage({ consent: true, channel: 'WHATSAPP', hasContact: false }), false);
  assert.equal(canSendMessage({ consent: null, channel: 'EMAIL', hasContact: false }), false);
});

/* ---------------- normalizeInboundText ---------------- */

test('normalizeInboundText lowercases, trims, strips accents, collapses whitespace', () => {
  assert.equal(normalizeInboundText('  ARRÊTEZ  les   messages '), 'arretez les messages');
  assert.equal(normalizeInboundText('STOP!'), 'stop!');
  assert.equal(normalizeInboundText(''), '');
  assert.equal(normalizeInboundText(null), '');
  assert.equal(normalizeInboundText(undefined), '');
  assert.equal(normalizeInboundText('  Désinscrire  '), 'desinscrire');
});

/* ---------------- isStopText ---------------- */

test('isStopText matches the canonical STOP keywords', () => {
  assert.equal(isStopText('STOP'), true);
  assert.equal(isStopText('stop'), true);
  assert.equal(isStopText('Arrête'), true);
  assert.equal(isStopText('ARRÊT'), true);
  assert.equal(isStopText('unsubscribe'), true);
  assert.equal(isStopText('ne veux plus recevoir'), true);
  assert.equal(isStopText('désinscrire'), true);
  assert.equal(isStopText('stoppe'), true);
  assert.equal(isStopText('stopper'), true);
  assert.equal(isStopText('opt out'), true);
  assert.equal(isStopText('opt-out'), true);
  assert.equal(isStopText('retirer'), true);
  assert.equal(isStopText('ne plus'), true);
  assert.equal(isStopText('unsub'), true);
});

test('isStopText matches keywords embedded in short messages', () => {
  assert.equal(isStopText('stop svp'), true);
  assert.equal(isStopText('arrête les messages'), true); // 19 chars
  assert.equal(isStopText('please stop'), true);
});

test('isStopText rejects long conversational replies (no false positives)', () => {
  assert.equal(isStopText('stopped by to say hi was great'), false); // 29? no: 30 chars? -> check
  assert.equal(isStopText('I was stopped at the light near your shop, thanks!'), false);
  assert.equal(isStopText('help'), false);
  assert.equal(isStopText(''), false);
  assert.equal(isStopText(null), false);
  assert.equal(isStopText(undefined), false);
});

/* ---------------- isHelpText ---------------- */

test('isHelpText matches the canonical HELP keywords', () => {
  assert.equal(isHelpText('HELP'), true);
  assert.equal(isHelpText('help'), true);
  assert.equal(isHelpText('aide'), true);
  assert.equal(isHelpText('infos'), true);
  assert.equal(isHelpText('info'), true);
  assert.equal(isHelpText('aidez-moi'), true);
  assert.equal(isHelpText('heures'), true);
  assert.equal(isHelpText('hours'), true);
  assert.equal(isHelpText('quelles sont vos heures'), true); // short message with keyword
});

test('isHelpText rejects unrelated or long messages', () => {
  assert.equal(isHelpText('stop'), false);
  assert.equal(isHelpText(''), false);
  assert.equal(isHelpText(null), false);
  assert.equal(isHelpText('thanks for the great service yesterday, the furnace works perfectly now'), false);
});
