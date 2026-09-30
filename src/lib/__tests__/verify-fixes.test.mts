/**
 * Verification of the 10 Copilot QA fixes (2026-09-30 deep bot testing).
 * Runs the REAL runCopilot() engine + parser with a stubbed prisma.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./prisma-stub-loader.mjs', import.meta.url);

const { runCopilot } = await import('../copilot/engine.ts');
const {
  detectIntent,
  extractCustomerName,
  extractInvalidDate,
  extractPhone,
  extractServiceTitle,
} = await import('../copilot/parse.ts');
const { resetWriteCalls, clearFixtures } = await import('./prisma-stub.mjs');

async function ask(message: string, history: any[] = []) {
  resetWriteCalls();
  clearFixtures();
  return runCopilot('biz-verify', 'user-verify', message, history);
}

test('1. "What is 10% of 500?" -> 10% of 500 = 50', async () => {
  const r = await ask('What is 10% of 500?');
  assert.equal(r.intent, 'calculate');
  assert.match(r.reply, /10\s?% of 500 = 50/);
});

test('2. "What is 100 times 1.13?" -> 113', async () => {
  const r = await ask('What is 100 times 1.13?');
  assert.equal(r.intent, 'calculate');
  assert.match(r.reply.trim(), /= 113(\.0+)?$/);
});

test('3. "What is my total revenue?" -> ask_revenue + all-time branch exists', async () => {
  assert.equal(detectIntent('What is my total revenue?'), 'ask_revenue');
  const src = readFileSync(new URL('../copilot/engine.ts', import.meta.url), 'utf8');
  assert.match(src, /Total revenue \(all time\)/);
  assert.match(src, /totalRevenue\(businessId\)/);
});

test('4. "Schedule a job for February 30" warns, no Mar 2 in preview', async () => {
  const r = await ask('Schedule a job for February 30', []);
  assert.ok(extractInvalidDate('Schedule a job for February 30'));
  assert.doesNotMatch(r.reply, /Mar 2/);
  assert.doesNotMatch(r.reply, /2027-03-02/);
  assert.match(r.reply, /isn.t a real calendar date/i);
});

test('5. "Book a job" asks for details, no invented preview', async () => {
  const r = await ask('Book a job', []);
  assert.match(r.reply, /what.s the job|what kind of job|tell me the service/i);
  assert.equal(r.preview, undefined);
});

test('6. "Schedule something for next Monday" -> no invented "Something" service', async () => {
  assert.equal(extractServiceTitle('Schedule something for next Monday'), null);
});

test('7. "Delete all my customers" -> explicit refusal', async () => {
  const r = await ask('Delete all my customers', []);
  assert.equal(r.intent, 'refuse_destructive');
  assert.match(r.reply, /I can.t delete|never delete/i);
});

test('8. "Cancel all my jobs" -> explicit refusal', async () => {
  const r = await ask('Cancel all my jobs', []);
  assert.equal(r.intent, 'refuse_destructive');
  assert.match(r.reply, /I can.t delete|never delete/i);
});

test('9. "Add customer John Smith with phone +14165550123" parses name+phone', async () => {
  const msg = 'Add customer John Smith with phone +14165550123';
  assert.equal(detectIntent(msg), 'create_customer');
  assert.equal(extractCustomerName(msg), 'John Smith');
  assert.ok(extractPhone(msg));
});

test('10. "Create an invoice for $500" guides to Invoices, not a job', async () => {
  const r = await ask('Create an invoice for $500', []);
  assert.equal(r.intent, 'out_of_scope');
  assert.match(r.reply, /Invoices page/i);
  assert.equal(r.preview, undefined);
});

test('bonus. "Schedule a job for February 30" yields no service title', async () => {
  assert.equal(extractServiceTitle('Schedule a job for February 30'), null);
});
