/**
 * Copilot parser regression tests — pure functions from src/lib/copilot/parse.ts.
 * Covers the real-world Hinglish/English prompts flagged by production QA.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIntent,
  extractCustomerName,
  extractDate,
  extractMoney,
  extractServiceTitle,
} from '../copilot/parse.ts';

// --- Intent: service + date + price is a booking, not a schedule query ---
test('detectIntent: "25 ko bijli ka kaam 2000 me" is create_job', () => {
  assert.equal(detectIntent('25 ko bijli ka kaam 2000 me'), 'create_job');
});

test('detectIntent: service + date without question is create_job', () => {
  assert.equal(detectIntent('kal AC service'), 'create_job');
});

test('detectIntent: service + date WITH question stays a query', () => {
  const i = detectIntent('kal bijli ka kaam hai?');
  assert.notEqual(i, 'create_job');
});

test('detectIntent: bare schedule query still works', () => {
  assert.equal(detectIntent('kal ke jobs?'), 'ask_schedule');
});

test('detectIntent: cancellation never books', () => {
  assert.notEqual(detectIntent('kal ka job cancel karo'), 'create_job');
});

// --- Entities for the date+price prompt ---
test('extractDate: "25 ko" resolves to the 25th', () => {
  const d = extractDate('25 ko bijli ka kaam 2000 me');
  assert.ok(d && d.endsWith('-25'), `got ${d}`);
});

test('extractMoney: "2000 me" is a price', () => {
  assert.equal(extractMoney('25 ko bijli ka kaam 2000 me'), 2000);
});

test('extractServiceTitle: "bijli" maps to Electrical Work', () => {
  assert.equal(extractServiceTitle('25 ko bijli ka kaam 2000 me'), 'Electrical Work');
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

test('extractCustomerName: "for Priya tomorrow morning" keeps Priya', () => {
  assert.equal(extractCustomerName('book a plumbing repair for Priya tomorrow morning'), 'Priya');
});

test('extractCustomerName: three-word real name is kept whole', () => {
  assert.equal(extractCustomerName('book AC service for Ramesh Kumar Singh'), 'Ramesh Kumar Singh');
});

test('extractCustomerName: honorific pattern still works', () => {
  assert.equal(extractCustomerName('Sharma ji ke liye kal AC service book karo'), 'Sharma');
});

test('extractCustomerName: service words are never names', () => {
  assert.equal(extractCustomerName('25 ko bijli ka kaam 2000 me'), null);
});
