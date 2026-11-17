/**
 * S4 P2 — public unauthenticated abuse surfaces use the durable limiter.
 *
 * The in-memory token bucket is per-instance: on Vercel serverless a
 * limit of N/hour is really ~N/hour *per instance*, so a public endpoint
 * (support tickets, pay links, agent search, places search, token pages,
 * quote requests) can be burst N x instance-count. The durable limiter
 * keeps the count in the RateLimit table, so the limit holds across
 * instances and cold starts.
 *
 * This test pins the P2 migration: every file in P2_FILES must call
 * rateLimitDurable (and import it from @/lib/rate-limit-durable) and must
 * NOT call the in-memory rateLimit or import it. A new public surface
 * that uses the in-memory limiter fails here — add it to this list and
 * swap it, or justify the exception in a comment.
 *
 * The limiter itself (cross-instance count, fail-closed, E2E gate) is
 * covered by rate-limit-durable.test.mts; the stubbed-prisma delegates
 * in customer-agent-keys-stub.mjs / customer-requests-stub.mjs let the
 * existing functional tests exercise the durable path end to end.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', '..'); // repo root (tests live in src/lib/__tests__)

/** P2 files: public unauthenticated surfaces (slice B §5.1). */
const P2_FILES = [
  // spam / abuse entry points
  'src/app/api/support/ticket/route.ts',
  'src/app/api/pay/invoice/route.ts',
  'src/app/api/pay/quote-deposit/route.ts',
  // public agent protocol
  'src/app/api/agent/v1/search/route.ts',
  'src/app/api/agent/v1/pros/[slug]/route.ts',
  'src/app/api/agent/v1/proposals/route.ts',
  // public search + token-gated polling/signing
  'src/app/api/places/search/route.ts',
  'src/app/api/track/[token]/ping/route.ts',
  'src/app/api/sign/[token]/route.ts',
  // token pages (the 256-bit token IS the authorization)
  'src/app/i/[token]/page.tsx',
  'src/app/portal/[token]/page.tsx',
  'src/app/q/[token]/page.tsx',
  'src/app/sign/[token]/page.tsx',
  'src/app/track/[token]/page.tsx',
  // customer quote requests (spam-prone) + public directory limits
  'src/app/actions/customer-requests.ts',
  'src/app/actions/directory.ts',
  // per-key limits on the public API surfaces
  'src/lib/apiKeys.ts',
  'src/lib/customer-agent-keys.ts',
];

test('S4 P2: all 18 public surfaces use the durable limiter', () => {
  assert.equal(P2_FILES.length, 18, 'P2 list changed — update the count and the review below');
  for (const rel of P2_FILES) {
    const src = readFileSync(join(SRC, rel), 'utf8');
    assert.ok(
      src.includes("from '@/lib/rate-limit-durable'"),
      `${rel}: must import from @/lib/rate-limit-durable`,
    );
    assert.ok(
      /rateLimitDurable\s*\(/.test(src),
      `${rel}: must call rateLimitDurable(`,
    );
    assert.ok(
      !/from '@\/lib\/rate-limit'/.test(src),
      `${rel}: must not import the in-memory limiter`,
    );
    // A bare rateLimit( call — rateLimitDurable( does not match because
    // `Durable` follows `rateLimit` before any `(`.
    assert.ok(
      !/(?<![A-Za-z])rateLimit\s*\(/.test(src),
      `${rel}: must not call the in-memory rateLimit(`,
    );
  }
});
