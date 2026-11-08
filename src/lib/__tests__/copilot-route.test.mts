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

async function postMessage(message) {
  const req = new Request('http://localhost/api/copilot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
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
