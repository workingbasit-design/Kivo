/**
 * In-memory stub for the copilot route test (2026-11-08): the real engine
 * runs against the shared prisma stub (fixtures for past quotes), while
 * session / membership / rate-limit / CSRF / locale / NextResponse are
 * faked so POST /api/copilot can run under node --test.
 */
import { prisma, setFixture, clearFixtures, resetReadCalls, resetWriteCalls } from './prisma-stub.mjs';

export { prisma, setFixture, clearFixtures, resetReadCalls, resetWriteCalls };

export async function getSession() {
  return { user: { id: 'user-test' } };
}

export async function getActiveMembershipForUser() {
  return { businessId: 'biz-test', role: 'OWNER' };
}

export function rateLimit() {
  return { ok: true };
}

export function checkSameOrigin() {
  return { ok: true };
}

export function originForbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
}

export async function getLocale() {
  return 'en';
}

export class NextResponse {
  static json(data, init) {
    const body = JSON.stringify(data);
    const res = new Response(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
    res._json = data;
    return res;
  }
}
