/**
 * French-language guarantees for the Copilot bot.
 * - buildConfirmReply: the deterministic booking reply must be fully
 *   English or fully Canadian French — never Hinglish (regression lock
 *   for the 2026-10-01 'Job book ho gayi!' fix).
 * - buildSystemPrompt: the Claude layer must force Canadian French when
 *   the app UI is French, even for English/ambiguous user messages.
 * Pure helpers only — no DB, no network, no API key.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/copilot-french.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfirmReply } from '@/lib/copilot/confirm-reply.ts';
import { buildSystemPrompt } from '@/lib/copilot/anthropic.ts';

const DRAFT = { title: 'Fix leaky faucet', date: '2026-10-05', time: '09:00', price: 120 };

const HINGLISH_MARKERS = [
  'ho gayi',
  'ho gaya',
  'mein dekh',
  'mein ',
  'Yeh ',
  'yeh ',
  'pehle hi',
  'chuki hai',
  'chuka hai',
];

function assertNoHinglish(reply: string) {
  for (const m of HINGLISH_MARKERS) {
    assert.ok(!reply.includes(m), `reply must not contain Hinglish marker "${m.trim()}": ${reply}`);
  }
}

test('buildConfirmReply: English reply is English, no Hinglish', () => {
  const r = buildConfirmReply(DRAFT, 'Sarah', false, 'CAD', false);
  assert.ok(r.includes('Job booked!'), 'English headline');
  assert.ok(r.includes('You can see it on the Schedule page.'), 'English schedule line');
  assert.ok(r.includes('Price'), 'English price label');
  assertNoHinglish(r);
});

test('buildConfirmReply: French reply is Canadian French, no Hinglish', () => {
  const r = buildConfirmReply(DRAFT, 'Sarah', false, 'CAD', true);
  assert.ok(r.includes('Travail réservé!'), 'French headline');
  assert.ok(r.includes('Vous pouvez le voir sur la page Horaire.'), 'French schedule line');
  assert.ok(r.includes('Prix'), 'French price label');
  assert.ok(!r.includes('Job booked!'), 'no English headline in French reply');
  assertNoHinglish(r);
});

test('buildConfirmReply: duplicate booking is French when fr=true', () => {
  const r = buildConfirmReply(DRAFT, 'Sarah', true, 'CAD', true);
  assert.ok(r.includes('déjà confirmée'), 'French duplicate line');
  assert.ok(!r.includes('already confirmed'), 'no English duplicate line');
  assertNoHinglish(r);
});

test('buildSystemPrompt: French UI forces Canadian French', () => {
  const p = buildSystemPrompt('fr');
  assert.ok(p.includes('Canadian French'), 'French instruction present');
  assert.ok(!p.includes("user's language: plain Canadian English"), 'no English-default rule');
  assert.ok(p.includes('NEVER use Hinglish'), 'Hinglish ban kept');
});

test('buildSystemPrompt: English UI keeps the language-following rule', () => {
  const p = buildSystemPrompt('en');
  assert.ok(p.includes('plain Canadian English'), 'English default present');
  assert.ok(p.includes('Canadian French when the user writes in French'), 'French-on-French-input kept');
  assert.ok(p.includes('NEVER use Hinglish'), 'Hinglish ban kept');
});

test('buildSystemPrompt: defaults to English when locale is absent', () => {
  const p = buildSystemPrompt();
  assert.ok(p.includes('plain Canadian English'), 'defaults to English');
});
