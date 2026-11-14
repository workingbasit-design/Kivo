/**
 * Regression tests for POST /api/copilot's needsConfirm gate (2026-11-08
 * deep test): the widget only renders a preview card when the response
 * says needsConfirm, and the route only set it for create_job /
 * create_customer — so a draft_quote reply carried the preview but the
 * card never rendered and the quote could never be confirmed.
 *
 * The real engine runs against the shared prisma stub; the route's auth,
 * rate-limit, CSRF and locale are faked. ANTHROPIC_API_KEY is unset in
 * tests, so the deterministic engine reply is used.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *   src/lib/__tests__/copilot-route.test.mts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./copilot-route-stub-loader.mjs', import.meta.url);

const { POST } = await import('@/app/api/copilot/route.ts');
const stub = await import('./copilot-route-stub.mjs');
const { writeCalls } = await import('./prisma-stub.mjs');

async function postMessage(message) {
  const req = new Request('http://localhost/api/copilot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

async function postConfirm(preview, idempotencyKey) {
  const req = new Request('http://localhost/api/copilot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      confirm: true,
      previewType: 'quote',
      preview,
      idempotencyKey,
    }),
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

/** Fixtures for a quote confirm against an existing customer in ON (HST 13%). */
function quoteConfirmFixtures() {
  stub.setFixture('customer', 'findMany', [{ id: 'cust-1', name: 'Sarah' }]);
  stub.setFixture('business', 'findUnique', { regionCode: 'CA', taxRegion: 'ON' });
  stub.setFixture('quote', 'create', { id: 'q-1', number: 'Q-0001' });
}

beforeEach(() => {
  stub.clearFixtures();
  stub.resetReadCalls();
  stub.resetWriteCalls();
});

test('route: draft_quote returns needsConfirm + previewKind quote + preview', async () => {
  stub.setFixture('quote', 'findMany', [{ totalCents: 22600n }]);
  const { status, body } = await postMessage('Create a quote for Sarah for furnace tune-up');
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.intent, 'draft_quote');
  assert.equal(body.needsConfirm, true, 'the widget renders the card only when needsConfirm');
  assert.equal(body.previewKind, 'quote');
  assert.ok(body.preview, 'expected a quote draft preview');
  assert.equal(body.preview.price, 226);
  assert.equal(body.preview.priceSource, 'history');
  assert.match(body.reply, /Suggested from similar past quotes/);
});

test('route: create_job still returns needsConfirm + previewKind job', async () => {
  const { status, body } = await postMessage('Book a job for Sarah tomorrow at 10am, $100');
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.intent, 'create_job');
  assert.equal(body.needsConfirm, true);
  assert.equal(body.previewKind, 'job');
  assert.ok(body.preview);
});

test('route: a plain question returns needsConfirm false and no preview', async () => {
  const { status, body } = await postMessage('Who owes me money?');
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.needsConfirm, false);
  assert.equal(body.preview, null);
});

// 2026-11-14 deep test: the quote median suggestion comes from past quote
// TOTALS (tax-inclusive), so it routinely carries cents ($169.50). The old
// quoteConfirmSchema required z.number().int(), so every such confirm
// failed validation with a 400 and the widget showed the generic booking
// error — a drafted quote could never be created when the median had cents.
test('route: quote confirm accepts a cents price from the median suggestion', async () => {
  quoteConfirmFixtures();
  const { status, body } = await postConfirm(
    { title: 'Furnace tune-up', customerName: 'Sarah', price: 169.5 },
    'test-quote-cents-1'
  );
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.created, true);
  assert.equal(body.intent, 'create_quote');
  assert.match(body.reply, /Quote created/);
  const line = writeCalls.find((w) => w.model === 'quoteLineItem' && w.method === 'createMany');
  assert.ok(line, 'expected a quote line item write');
  assert.equal(line.args.data[0].unitPriceCents, 16950n, 'line price is the suggested $169.50 in cents');
  // The quote.create call itself is fixture-backed (returns Q-0001), so it
  // is not in writeCalls — assert on the reply number instead.
  assert.match(body.reply, /Q-0001/);
});

test('route: quote confirm rejects a price with more than 2 decimals', async () => {
  quoteConfirmFixtures();
  const { status, body } = await postConfirm(
    { title: 'Furnace tune-up', customerName: 'Sarah', price: 169.555 },
    'test-quote-3dp-1'
  );
  assert.equal(status, 400, JSON.stringify(body));
  assert.match(body.error, /didn't validate/);
});

test('route: quote confirm with an unmatched customer names the actual failure', async () => {
  stub.setFixture('customer', 'findMany', []);
  stub.setFixture('business', 'findUnique', { regionCode: 'CA', taxRegion: 'ON' });
  const { status, body } = await postConfirm(
    { title: 'Furnace tune-up', customerName: 'Nobody', price: 170 },
    'test-quote-nocust-1'
  );
  assert.equal(status, 400, JSON.stringify(body));
  assert.match(body.error, /isn't in your customers/);
});
