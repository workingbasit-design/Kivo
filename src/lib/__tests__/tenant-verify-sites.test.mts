/**
 * P1.0 (audit slice A §1.3): the four unsafeUnscoped sites that needed
 * verification. Each test pins the verified-safe shape:
 *
 * 1. proposals byId — KEPT: the Agent Protocol schema and the public
 *    SKILL.md document businessId as an accepted identifier, so deleting
 *    the path would break public API. Verified safe: it returns only
 *    {id, name, slug} for directory-opted-in + verified + enabled
 *    businesses — the same public data the slug path returns.
 * 2. idempotency null-business replay — the lookup is scoped by
 *    endpoint+key, exactly what the partial unique index enforces, and
 *    withIdempotency currently has NO production call sites (only its
 *    test), so the null-business paths are unreachable in production.
 * 3. idempotency null-business delete — hardened in this package: the
 *    delete re-validates endpoint+key+businessId:null instead of trusting
 *    the server-generated id alone.
 * 4. team-invite by-user — ACCEPTED as designed: the lookup must see all
 *    of the invited user's memberships to distinguish an orphan from a
 *    real account of another business, and it selects only businessId +
 *    status (no names/emails). The distinct error strings are needed UX
 *    for the inviting admin, who already knows the email; the oracle
 *    reveals only that an account exists for it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function src(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('proposals byId (verified safe, kept as public API)', () => {
  const route = src('app/api/agent/v1/proposals/route.ts');
  const protocol = src('lib/agent-protocol.ts');
  it('returns only public directory fields', () => {
    assert.ok(route.includes("return { id: b.id, name: b.name, slug: b.bookingPage.slug };"));
    // Scope the check to resolveEligibleBusiness: the rest of the route
    // legitimately handles customerEmail for the proposal itself.
    const fn = route.slice(
      route.indexOf('async function resolveEligibleBusiness'),
      route.indexOf('function proposalPayload'),
    );
    assert.ok(fn.length > 0, 'resolveEligibleBusiness must exist');
    assert.ok(!fn.includes('email'), 'byId path must never return contact fields');
  });

  it('is a documented protocol input, not dead surface', () => {
    assert.ok(protocol.includes('businessId: z.string()'));
  });
});

describe('idempotency null-business paths', () => {
  const code = src('lib/idempotency.ts');
  it('replay lookup is scoped by endpoint+key under businessId:null', () => {
    assert.ok(
      code.includes('where: { businessId: null, endpoint: scope.endpoint, key: scope.key }'),
    );
  });

  it('delete re-validates endpoint+key+businessId:null, not the id alone', () => {
    assert.ok(
      code.includes(
        'where: { id: rowId, businessId: null, endpoint: scope.endpoint, key: scope.key }',
      ),
    );
    assert.ok(!code.includes('deleteMany({ where: { id: rowId } })'));
  });
});

describe('team-invite by-user (accepted as designed)', () => {
  const code = src('lib/team-invite.ts');
  it('selects only businessId + status — no row contents leak', () => {
    assert.ok(code.includes("select: { businessId: true, status: true },"));
  });
});
