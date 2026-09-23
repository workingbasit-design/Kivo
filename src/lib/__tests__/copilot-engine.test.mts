/**
 * Copilot engine scenario tests — run realistic EN + Canadian French
 * messages through the REAL runCopilot() (parser + preview path) with a
 * stubbed prisma. Asserts the explicit-confirm boundary: the copilot must
 * NEVER write to the database, only return previews.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Redirect @/lib/prisma to the stub BEFORE the engine is imported.
register('./prisma-stub-loader.mjs', import.meta.url);

const { runCopilot } = await import('../copilot/engine.ts');
const { writeCalls, resetWriteCalls, setFixture, clearFixtures } = await import('./prisma-stub.mjs');

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function convo(message: string, locale?: string) {
  resetWriteCalls();
  clearFixtures();
  const res = await runCopilot('biz-test', 'user-test', message, [], locale ? { locale } : {});
  assert.equal(writeCalls.length, 0, `copilot WROTE to db for "${message}": ${JSON.stringify(writeCalls)}`);
  return res;
}

// --- The reported failure: "schedule a Jon for 29th october" ---
test('engine: "schedule a Jon for 29th october" previews Jon on Oct 29', async () => {
  const res = await convo('schedule a Jon for 29th october');
  assert.equal(res.intent, 'create_job');
  assert.ok(res.preview, 'expected a booking preview');
  assert.equal(res.preview.customerName, 'Jon');
  assert.ok(res.preview.date.endsWith('-10-29'), `got ${res.preview.date}`);
  assert.match(res.reply, /please confirm/i);
  assert.doesNotMatch(res.reply, /wasn.t clear/, 'should not show the date-unclear note');
  assert.doesNotMatch(res.reply, /couldn.t find the customer name/, 'should not show the name-missing note');
});

// --- Full booking phrasing ---
test('engine: "AC repair for Sarah tomorrow at 3pm, $800" previews everything', async () => {
  const res = await convo('AC repair for Sarah tomorrow at 3pm, $800');
  assert.equal(res.intent, 'create_job');
  assert.equal(res.preview?.customerName, 'Sarah');
  assert.equal(res.preview?.date, tomorrowISO());
  assert.equal(res.preview?.time, '15:00');
  assert.equal(res.preview?.price, 800);
  assert.equal(res.preview?.title, 'AC Service');
});

test('engine: "book Priya for tomorrow morning" defaults time to 10:00', async () => {
  const res = await convo('book Priya for tomorrow morning');
  assert.equal(res.preview?.customerName, 'Priya');
  assert.equal(res.preview?.time, '10:00');
});

test('engine: French booking previews in French', async () => {
  const res = await convo('plomberie pour Sarah demain 800$', 'fr');
  assert.equal(res.intent, 'create_job');
  assert.equal(res.preview?.customerName, 'Sarah');
  assert.equal(res.preview?.price, 800);
  assert.match(res.reply, /confirmez/i);
});

// --- Adversarial: must ask, never invent, never book ---
test('engine: "schedule a job for 29th october" asks for the missing name', async () => {
  const res = await convo('schedule a job for 29th october');
  assert.equal(res.intent, 'create_job');
  assert.equal(res.preview?.customerName, '');
  assert.match(res.reply, /couldn.t find the customer name/i);
});

test('engine: "schedule cleaning for tomorrow" does not invent a customer', async () => {
  const res = await convo('schedule cleaning for tomorrow');
  assert.equal(res.preview?.customerName, '');
  assert.match(res.reply, /couldn.t find the customer name/i);
});

test('engine: "schedule it for tomorrow" does not book customer "It"', async () => {
  const res = await convo('schedule it for tomorrow');
  assert.equal(res.preview?.customerName, '');
});

test('engine: cancellation never books, asks instead', async () => {
  const res = await convo("cancel tomorrow's job");
  assert.notEqual(res.intent, 'create_job');
  assert.ok(res.reply.length > 20, 'should ask a clarifying question');
});

test('engine: French cancellation never books', async () => {
  const res = await convo('annuler le travail de demain');
  assert.notEqual(res.intent, 'create_job');
});

test('engine: "looking for a plumber" does not book', async () => {
  const res = await convo('looking for a plumber');
  assert.notEqual(res.intent, 'create_job');
  assert.ok(!res.preview, 'no booking preview should be produced');
});

test('engine: dateless booking says the date was unclear', async () => {
  const res = await convo('plumbing for Priya at 15h30');
  assert.equal(res.intent, 'create_job');
  assert.match(res.reply, /wasn.t clear/i);
});

// --- Other intents through the engine ---
test('engine: reminder draft says nothing was sent', async () => {
  const res = await convo('remind me to call Sarah tomorrow');
  assert.equal(res.intent, 'draft_reminder');
  assert.match(res.reply, /no unpaid invoices/i);
});

test('engine: reminder draft with an unpaid invoice is explicit that nothing was sent', async () => {
  resetWriteCalls();
  clearFixtures();
  setFixture('invoice', 'findMany', [
    {
      id: 'inv-1',
      number: 'INV-1042',
      total: 800,
      status: 'UNPAID',
      date: new Date(),
      customer: { name: 'Sarah Tremblay', phone: '4165551234' },
      payments: [],
    },
  ]);
  const res = await runCopilot('biz-test', 'user-test', 'remind Sarah about her invoice', [], {});
  assert.equal(res.intent, 'draft_reminder');
  assert.match(res.reply, /NOT sent/i);
  assert.match(res.reply, /INV-1042/);
  assert.equal(writeCalls.length, 0, 'copilot must never send or write');
});

test('engine: revenue question answered', async () => {
  const res = await convo('how much did I earn today?');
  assert.equal(res.intent, 'ask_revenue');
  assert.ok(res.reply.length > 10);
});

test('engine: schedule question with no jobs', async () => {
  const res = await convo("what's on my schedule tomorrow?");
  assert.equal(res.intent, 'ask_schedule');
  assert.match(res.reply, /no jobs scheduled/i);
});

test('engine: unpaid question with no invoices', async () => {
  const res = await convo('who has unpaid invoices?');
  assert.equal(res.intent, 'ask_unpaid');
  assert.ok(res.reply.length > 10);
});

// --- Bare "job" booking noun: preview-only, zero writes ---
test('engine: "job on 1st jan for Sarah" previews Sarah on Jan 1', async () => {
  const res = await convo('job on 1st jan for Sarah');
  assert.equal(res.intent, 'create_job');
  assert.ok(res.preview, 'expected a booking preview');
  assert.equal(res.preview.customerName, 'Sarah');
  assert.ok(res.preview.date.endsWith('-01-01'), `got ${res.preview.date}`);
  assert.match(res.reply, /please confirm/i);
});

test('engine: "job for Sarah at 9:30 am" previews today 09:30 with the date-unclear note', async () => {
  const res = await convo('job for Sarah at 9:30 am');
  assert.equal(res.intent, 'create_job');
  assert.equal(res.preview?.customerName, 'Sarah');
  assert.equal(res.preview?.time, '09:30');
  assert.match(res.reply, /wasn.t clear/, 'should show the date-unclear note');
  assert.match(res.reply, /please confirm/i);
});

test('engine: "travail pour Sarah demain" previews in French', async () => {
  const res = await convo('travail pour Sarah demain', 'fr');
  assert.equal(res.intent, 'create_job');
  assert.equal(res.preview?.customerName, 'Sarah');
  assert.match(res.reply, /confirmez/i);
});
