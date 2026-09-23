/**
 * Copilot parser regression tests — pure functions from src/lib/copilot/parse.ts.
 * English + Canadian French (Canada-only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIntent,
  extractCustomerName,
  extractDate,
  extractMoney,
  extractPhone,
  extractServiceTitle,
  extractTime,
} from '../copilot/parse.ts';

// --- Intent: service + date + price is a booking, not a schedule query ---
test('detectIntent: "plumbing for Sarah tomorrow 800" is create_job', () => {
  assert.equal(detectIntent('plumbing for Sarah tomorrow 800'), 'create_job');
});

test('detectIntent: service + date without question is create_job', () => {
  assert.equal(detectIntent('AC service tomorrow'), 'create_job');
});

test('detectIntent: service + date WITH question stays a query', () => {
  const i = detectIntent('is there plumbing work tomorrow?');
  assert.notEqual(i, 'create_job');
});

test('detectIntent: bare schedule query still works', () => {
  assert.equal(detectIntent("what's on tomorrow?"), 'ask_schedule');
});

test('detectIntent: cancellation never books', () => {
  assert.notEqual(detectIntent("cancel tomorrow's job"), 'create_job');
});

// --- French booking ---
test('detectIntent: "plomberie pour Sarah demain 800$" is create_job', () => {
  assert.equal(detectIntent('plomberie pour Sarah demain 800$'), 'create_job');
});

test('detectIntent: French cancellation never books', () => {
  assert.notEqual(detectIntent('annuler le travail de demain'), 'create_job');
});

// --- Entities ---
test('extractDate: "25 oct" resolves to Oct 25', () => {
  const d = extractDate('plumbing on 25 oct for Sarah');
  assert.ok(d && d.endsWith('-10-25'), `got ${d}`);
});

test('extractDate: "demain" is tomorrow', () => {
  const d = extractDate('plomberie demain');
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  assert.equal(d, `${y}-${m}-${day}`);
});

test('extractMoney: "$2,000" is a price', () => {
  assert.equal(extractMoney('AC repair for Sarah tomorrow $2,000'), 2000);
});

test('extractMoney: "800$" is a price', () => {
  assert.equal(extractMoney('plomberie demain 800$'), 800);
});

test('extractMoney: bare "800" in booking context is a price', () => {
  assert.equal(extractMoney('plumbing for Sarah tomorrow 800'), 800);
});

test('extractServiceTitle: "plumbing" maps to Plumbing Work', () => {
  assert.equal(extractServiceTitle('plumbing for Sarah tomorrow 800'), 'Plumbing Work');
});

test('extractServiceTitle: "plomberie" maps to Plumbing Work', () => {
  assert.equal(extractServiceTitle('plomberie pour Sarah demain'), 'Plumbing Work');
});

test('extractPhone: NANP 10-digit number', () => {
  assert.equal(extractPhone('call me at 416-555-0100'), '4165550100');
});

test('extractPhone: +1 prefix is stripped', () => {
  assert.equal(extractPhone('+1 416 555 0100'), '4165550100');
});

test('extractTime: "3pm" is 15:00', () => {
  assert.equal(extractTime('plumbing tomorrow 3pm'), '15:00');
});

test('extractTime: French "15h30" is 15:30', () => {
  assert.equal(extractTime('plomberie demain 15h30'), '15:30');
});

// --- Customer names: never truncate, never invent ---
test('extractCustomerName: multi-word name with filler is rejected, not truncated', () => {
  // "Nonexistent Person XYZ" — "Person" is a filler word; returning the
  // half-guessed "Nonexistent" as a customer would book under a wrong name.
  assert.equal(extractCustomerName('book a repair for Nonexistent Person XYZ'), null);
});

test('extractCustomerName: "for the guy" is rejected', () => {
  assert.equal(extractCustomerName('fix the thing for the guy'), null);
});

test('extractCustomerName: service words are never names', () => {
  assert.equal(extractCustomerName('plumbing work tomorrow 800'), null);
});

test('extractCustomerName: "pour Sarah Tremblay" works', () => {
  assert.equal(extractCustomerName('plomberie pour Sarah Tremblay demain'), 'Sarah Tremblay');
});

// --- Other intents ---
test('detectIntent: payment reminder draft', () => {
  assert.equal(detectIntent('draft a payment reminder for Sarah'), 'draft_reminder');
});

test('detectIntent: French payment reminder draft', () => {
  assert.equal(detectIntent('prépare un rappel de paiement pour Sarah'), 'draft_reminder');
});

test('detectIntent: revenue question', () => {
  assert.equal(detectIntent('what was my revenue this week?'), 'ask_revenue');
});

test('detectIntent: unpaid question', () => {
  assert.equal(detectIntent('who has unpaid invoices?'), 'ask_unpaid');
});

test('detectIntent: customer count', () => {
  assert.equal(detectIntent('how many customers do I have?'), 'ask_customers');
});

test('detectIntent: help', () => {
  assert.equal(detectIntent('help, what can you do?'), 'help');
});
