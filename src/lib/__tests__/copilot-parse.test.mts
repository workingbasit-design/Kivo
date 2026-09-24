/**
 * Copilot parser regression tests — pure functions from src/lib/copilot/parse.ts.
 * English + Canadian French (Canada-only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIntent,
  detectMessageLang,
  detectProvince,
  detectTrade,
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

// --- Regression: "schedule a Jon for 29th october" (wrong answers, 2026-09-23) ---
test('extractDate: "29th october" ordinal resolves to Oct 29', () => {
  const d = extractDate('schedule a Jon for 29th october');
  assert.ok(d && d.endsWith('-10-29'), `got ${d}`);
});

test('extractDate: "october 29th" month-first ordinal resolves to Oct 29', () => {
  const d = extractDate('schedule Jon for october 29th');
  assert.ok(d && d.endsWith('-10-29'), `got ${d}`);
});

test('extractDate: "1st jan" ordinal resolves to Jan 1', () => {
  const d = extractDate('job on 1st jan');
  assert.ok(d && d.endsWith('-01-01'), `got ${d}`);
});

test('extractCustomerName: "schedule a Jon for 29th october" finds Jon', () => {
  assert.equal(extractCustomerName('schedule a Jon for 29th october'), 'Jon');
});

test('extractCustomerName: "book Sarah for tomorrow" finds Sarah', () => {
  assert.equal(extractCustomerName('book Sarah for tomorrow'), 'Sarah');
});

test('extractCustomerName: "planifier Jon pour demain" finds Jon', () => {
  assert.equal(extractCustomerName('planifier Jon pour demain'), 'Jon');
});

test('extractCustomerName: explicit "for <name>" still wins', () => {
  assert.equal(extractCustomerName('schedule a job for Jon tomorrow'), 'Jon');
});

test('extractCustomerName: "schedule cleaning for tomorrow" finds no name', () => {
  assert.equal(extractCustomerName('schedule cleaning for tomorrow'), null);
});

test('extractCustomerName: "schedule a job for tomorrow" finds no name', () => {
  assert.equal(extractCustomerName('schedule a job for tomorrow'), null);
});

test('extractCustomerName: "schedule it for tomorrow" finds no name', () => {
  assert.equal(extractCustomerName('schedule it for tomorrow'), null);
});

test('extractCustomerName: "looking for a plumber" finds no name', () => {
  assert.equal(extractCustomerName('looking for a plumber tomorrow'), null);
});

test('detectIntent: "schedule a Jon for 29th october" is create_job', () => {
  assert.equal(detectIntent('schedule a Jon for 29th october'), 'create_job');
});

// --- Regression: real-scenario hardening matrix (2026-09-23) ---
test('extractCustomerName: trailing preposition dropped ("for Priya on 25 oct")', () => {
  assert.equal(extractCustomerName('plumbing for Priya on 25 oct, 900 dollars'), 'Priya');
});

test('extractCustomerName: "for Sarah tomorrow at 3pm" yields Sarah', () => {
  assert.equal(extractCustomerName('AC repair for Sarah tomorrow at 3pm, $800'), 'Sarah');
});

test('extractCustomerName: month is never a name ("book Sarah for dec 5")', () => {
  assert.equal(extractCustomerName('book Sarah for dec 5'), 'Sarah');
});

test('extractCustomerName: "for next Monday" yields no name from the date', () => {
  assert.equal(extractCustomerName('schedule Ramesh Kumar for next Monday'), 'Ramesh Kumar');
});

test('extractCustomerName: possessive ("schedule Sarah\'s AC repair") yields Sarah', () => {
  assert.equal(extractCustomerName("schedule Sarah's AC repair for tomorrow"), 'Sarah');
});

test('extractCustomerName: possessive verb stripped ("cancel tomorrow\'s job")', () => {
  assert.equal(extractCustomerName("cancel tomorrow's job"), null);
});

test('extractCustomerName: question word possessive ("what\'s on my schedule")', () => {
  assert.equal(extractCustomerName("what's on my schedule tomorrow?"), null);
});

test('extractCustomerName: phone between name and for ("book Sarah 4165551234 for tomorrow")', () => {
  assert.equal(extractCustomerName('book Sarah 4165551234 for tomorrow'), 'Sarah');
});

test('extractPhone: 10-digit NANP number', () => {
  assert.equal(extractPhone('book Sarah 4165551234 for tomorrow'), '4165551234');
});

test('extractPhone: "+1 416-555-1234" normalizes', () => {
  assert.equal(extractPhone('call +1 416-555-1234'), '4165551234');
});

test('detectIntent: "remind me to call Sarah tomorrow" is draft_reminder', () => {
  assert.equal(detectIntent('remind me to call Sarah tomorrow'), 'draft_reminder');
});

test('detectIntent: "how much did I earn today?" is ask_revenue', () => {
  assert.equal(detectIntent('how much did I earn today?'), 'ask_revenue');
});

test('detectIntent: "cancel tomorrow\'s job" never books and is not a schedule query', () => {
  const i = detectIntent("cancel tomorrow's job");
  assert.notEqual(i, 'create_job');
  assert.notEqual(i, 'ask_schedule');
});

test('detectIntent: "delete the job for Sarah" never books', () => {
  assert.notEqual(detectIntent('delete the job for Sarah'), 'create_job');
});

test('detectIntent: "looking for a plumber" does not book', () => {
  assert.notEqual(detectIntent('looking for a plumber'), 'create_job');
});

test('extractDate: "15h30" is not confused by "at 15h30"', () => {
  assert.equal(extractDate('plumbing for Priya at 15h30'), null);
});

test('extractTime: "demain soir" is 17:00', () => {
  assert.equal(extractTime('schedule Jon for demain soir'), '17:00');
});

test('extractTime: "9:30 am" is 09:30', () => {
  assert.equal(extractTime('job for Sarah at 9:30 am'), '09:30');
});

test('extractMoney: "2 thousand" is 2000', () => {
  assert.equal(extractMoney('AC repair for Sarah tomorrow 2 thousand'), 2000);
});

test('extractMoney: "800 cad" is 800', () => {
  assert.equal(extractMoney('book Mike for Friday, 800 cad'), 800);
});

// --- Bare "job" / "travail" booking noun (Track 1 hardening follow-up) ---
test('detectIntent: "job on 1st jan for Sarah" is create_job', () => {
  assert.equal(detectIntent('job on 1st jan for Sarah'), 'create_job');
});

test('detectIntent: "job for Sarah at 9:30 am" is create_job (time-only)', () => {
  assert.equal(detectIntent('job for Sarah at 9:30 am'), 'create_job');
});

test('detectIntent: "travail pour Sarah demain" is create_job', () => {
  assert.equal(detectIntent('travail pour Sarah demain'), 'create_job');
});

test('detectIntent: plural "jobs tomorrow" stays a schedule query', () => {
  assert.equal(detectIntent('jobs tomorrow'), 'ask_schedule');
});

test('detectIntent: "cancel the job" never books', () => {
  assert.notEqual(detectIntent('cancel the job'), 'create_job');
});

test('detectIntent: "how much was the job?" never books', () => {
  assert.notEqual(detectIntent('how much was the job?'), 'create_job');
});

test('detectIntent: "great job" alone never books', () => {
  assert.notEqual(detectIntent('great job'), 'create_job');
});

// --- Intent: customer creation is never a job booking (reported defect) ---
test('detectIntent: "Add a new customer named Testy McTestface with phone 416-555-0100" is create_customer', () => {
  assert.equal(detectIntent('Add a new customer named Testy McTestface with phone 416-555-0100'), 'create_customer');
});

test('detectIntent: "add a customer" is create_customer, not create_job', () => {
  assert.equal(detectIntent('add a customer'), 'create_customer');
});

test('detectIntent: French "ajouter un nouveau client" is create_customer', () => {
  assert.equal(detectIntent('ajouter un nouveau client nommé Sarah Tremblay'), 'create_customer');
});

test('detectIntent: "add job for Sarah tomorrow" is still create_job', () => {
  assert.equal(detectIntent('add job for Sarah tomorrow'), 'create_job');
});

// --- Intent: certification advice (reported defect) ---
test('detectIntent: plumber certification question is ask_certification', () => {
  assert.equal(
    detectIntent("I'm a plumber in Ontario. Which certification should I pursue next to advance my career?"),
    'ask_certification'
  );
});

test('detectIntent: French licence question is ask_certification', () => {
  assert.equal(detectIntent('Quelle licence me faut-il comme électricien au Québec?'), 'ask_certification');
});

// --- Intent: honest comparison (reported defect) ---
test('detectIntent: peer-comparison question is ask_compare', () => {
  assert.equal(
    detectIntent('How does my business compare to the average plumbing business in Toronto?'),
    'ask_compare'
  );
});

// --- Intent: out-of-scope boundary (reported defect) ---
test('detectIntent: weather question is out_of_scope', () => {
  assert.equal(detectIntent("What's the weather like in Toronto right now?"), 'out_of_scope');
});

test('detectIntent: "what\'s on tomorrow?" still asks the schedule', () => {
  assert.equal(detectIntent("what's on tomorrow?"), 'ask_schedule');
});

// --- Intent: French feminine forms (reported defect) ---
test('detectIntent: "Combien de factures impayées ai-je ?" is ask_unpaid', () => {
  assert.equal(detectIntent('Combien de factures impayées ai-je ?'), 'ask_unpaid');
});

// --- Language detection ---
test('detectMessageLang: French question detected', () => {
  assert.equal(detectMessageLang('Combien de factures impayées ai-je ?'), 'fr');
});

test('detectMessageLang: English question detected', () => {
  assert.equal(detectMessageLang('How many customers do I have?'), 'en');
});

test('detectMessageLang: no signal returns null', () => {
  assert.equal(detectMessageLang('Sarah'), null);
});

// --- extractServiceTitle: short keys need word boundaries (reported defect) ---
test('extractServiceTitle: "McTestface" is not AC Service', () => {
  assert.equal(extractServiceTitle('Add a new customer named Testy McTestface with phone 416-555-0100'), null);
});

test('extractServiceTitle: "AC repair" still maps to AC Service', () => {
  assert.equal(extractServiceTitle('AC repair for Sarah tomorrow'), 'AC Service');
});

// --- extractMoney: phone digits are never a price (reported defect) ---
test('extractMoney: phone-number digits are not a price', () => {
  assert.equal(extractMoney('Add a new customer named Testy McTestface with phone 416-555-0100'), null);
});

test('extractMoney: real price alongside a phone still parses', () => {
  assert.equal(extractMoney('plumbing for Sarah tomorrow 800, phone 416-555-0100'), 800);
});

// --- extractCustomerName: "named" pattern (reported defect) ---
test('extractCustomerName: "named Testy McTestface" works', () => {
  assert.equal(
    extractCustomerName('Add a new customer named Testy McTestface with phone 416-555-0100'),
    'Testy McTestface'
  );
});

test('extractCustomerName: "tell me about the customer named Nonexistent McFake" finds the name', () => {
  assert.equal(
    extractCustomerName('tell me about the customer named Nonexistent McFake'),
    'Nonexistent McFake'
  );
});

// --- detectTrade / detectProvince ---
test('detectTrade + detectProvince: "plumber in Ontario"', () => {
  assert.equal(detectTrade("I'm a plumber in Ontario"), 'plumbing');
  assert.equal(detectProvince("I'm a plumber in Ontario"), 'ON');
});

test('detectProvince: Québec', () => {
  assert.equal(detectProvince('plombier au Québec'), 'QC');
});

test('detectTrade: unknown trade returns null', () => {
  assert.equal(detectTrade("What's the weather like?"), null);
});

test('detectIntent: "What is my total booked revenue this month?" is ask_booked_revenue', () => {
  assert.equal(detectIntent('What is my total booked revenue this month?'), 'ask_booked_revenue');
});

test('detectIntent: "Quel est mon revenu réservé ce mois-ci ?" is ask_booked_revenue', () => {
  assert.equal(detectIntent('Quel est mon revenu réservé ce mois-ci ?'), 'ask_booked_revenue');
});

test('detectIntent: "how much did I earn today?" stays ask_revenue (collections)', () => {
  assert.equal(detectIntent('how much did I earn today?'), 'ask_revenue');
});
