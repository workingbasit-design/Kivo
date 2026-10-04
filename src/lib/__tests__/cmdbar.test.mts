/**
 * Tests for the command-bar natural-language parser (src/lib/cmdbar.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, commandLabel } from '../cmdbar.ts';

test('unpaid invoices (EN)', () => {
  assert.equal(parseCommand('unpaid invoices', 'en')?.href, '/invoices?status=UNPAID');
  assert.equal(parseCommand('show overdue invoices', 'en')?.href, '/invoices?status=UNPAID');
  assert.equal(parseCommand('find unpaid invoices', 'en')?.href, '/invoices?status=UNPAID');
});

test('create actions win over section matches (EN)', () => {
  assert.equal(parseCommand('create invoice', 'en')?.href, '/invoices/new');
  assert.equal(parseCommand('new quote', 'en')?.href, '/quotes/new');
  assert.equal(parseCommand('create quote for John Smith', 'en')?.href, '/quotes/new');
  assert.equal(parseCommand('add new customer', 'en')?.href, '/customers/new');
  assert.equal(parseCommand('book a job', 'en')?.href, '/jobs/new');
});

test('quote filters (EN)', () => {
  assert.equal(parseCommand('sent quotes', 'en')?.href, '/quotes?status=SENT');
  assert.equal(parseCommand('draft quotes', 'en')?.href, '/quotes?status=DRAFT');
});

test('schedule and modes (EN)', () => {
  assert.equal(parseCommand("today's schedule", 'en')?.href, '/schedule');
  assert.equal(parseCommand('what needs attention', 'en')?.href, '/attention');
  assert.equal(parseCommand('owner mode', 'en')?.href, '/owner');
  assert.equal(parseCommand('what-if scenarios', 'en')?.href, '/scenarios');
  assert.equal(parseCommand('voice mode', 'en')?.href, '/voice');
});

test('french commands', () => {
  assert.equal(parseCommand('factures impayées', 'fr')?.href, '/invoices?status=UNPAID');
  assert.equal(parseCommand('factures payées', 'fr')?.href, '/invoices?status=PAID');
  assert.equal(parseCommand('créer une facture', 'fr')?.href, '/invoices/new');
  assert.equal(parseCommand('nouvelle soumission', 'fr')?.href, '/quotes/new');
  assert.equal(parseCommand('à surveiller', 'fr')?.href, '/attention');
  assert.equal(parseCommand('mode vocal', 'fr')?.href, '/voice');
});

test('short or unknown queries return null', () => {
  assert.equal(parseCommand('ab', 'en'), null);
  assert.equal(parseCommand('flibbertigibbet', 'en'), null);
});

test('labels resolve in both locales', () => {
  const cmd = parseCommand('unpaid invoices', 'en')!;
  assert.equal(commandLabel(cmd, 'en'), 'Unpaid invoices');
  assert.equal(commandLabel(cmd, 'fr'), 'Factures impayées');
});
