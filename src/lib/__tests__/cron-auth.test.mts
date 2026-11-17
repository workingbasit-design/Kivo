/**
 * P1.0 (audit S2): cron authentication is header-only Bearer CRON_SECRET.
 *
 * Regression coverage for `src/lib/cron-auth.ts`:
 * - unset secret is a 401 (never a 500 that leaks config state);
 * - wrong bearer is a 401;
 * - correct bearer authorises (null);
 * - `?secret=<correct>` is rejected even when the value is right (the query
 *   parameter no longer works — query strings land in access logs);
 * - no cron route reads the query parameter or returns the old 500.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./next-server-stub-loader.mjs', import.meta.url);

const { requireCronAuth } = await import('../cron-auth.ts');

const SECRET = 'test-cron-secret-123';

function req(url: string, headers?: Record<string, string>): Request {
  return new Request(url, headers ? { headers } : undefined);
}

describe('requireCronAuth', () => {
  it('returns 401 when CRON_SECRET is unset (never a 500)', async () => {
    delete process.env.CRON_SECRET;
    const res = requireCronAuth(req('https://example.com/api/cron/messaging'));
    assert.ok(res, 'expected a 401 response, got null');
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Unauthorized.' });
  });

  it('returns 401 when no credentials are provided', async () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(req('https://example.com/api/cron/messaging'));
    assert.ok(res);
    assert.equal(res.status, 401);
  });

  it('returns 401 for a wrong bearer token', async () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(
      req('https://example.com/api/cron/messaging', {
        authorization: 'Bearer wrong-secret',
      }),
    );
    assert.ok(res);
    assert.equal(res.status, 401);
  });

  it('returns null for the correct bearer token', () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(
      req('https://example.com/api/cron/messaging', {
        authorization: `Bearer ${SECRET}`,
      }),
    );
    assert.equal(res, null);
  });

  it('accepts a case-insensitive Bearer prefix', () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(
      req('https://example.com/api/cron/messaging', {
        authorization: `bearer ${SECRET}`,
      }),
    );
    assert.equal(res, null);
  });

  it('returns 401 for an empty bearer value', () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(
      req('https://example.com/api/cron/messaging', {
        authorization: 'Bearer ',
      }),
    );
    assert.ok(res);
    assert.equal(res.status, 401);
  });

  it('rejects ?secret=<correct> with no header (regression: query param removed)', () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(
      req(`https://example.com/api/cron/messaging?secret=${SECRET}`),
    );
    assert.ok(res, 'query-param secret must not authorise');
    assert.equal(res.status, 401);
  });

  it('rejects ?secret=<correct> even alongside a wrong bearer', () => {
    process.env.CRON_SECRET = SECRET;
    const res = requireCronAuth(
      req(`https://example.com/api/cron/messaging?secret=${SECRET}`, {
        authorization: 'Bearer wrong-secret',
      }),
    );
    assert.ok(res);
    assert.equal(res.status, 401);
  });
});

describe('cron routes: no query-param secret anywhere', () => {
  it('no cron route reads searchParams secret or returns the old 500', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const cronDir = join(here, '..', '..', 'app', 'api', 'cron');
    const routes = readdirSync(cronDir).filter((d) => d !== '.' && d !== '..');
    assert.ok(routes.length >= 6, `expected 6 cron routes, found ${routes.length}`);
    for (const route of routes) {
      const src = readFileSync(join(cronDir, route, 'route.ts'), 'utf8');
      assert.ok(
        !src.includes("searchParams.get('secret')"),
        `${route}: still reads the ?secret= query parameter`,
      );
      assert.ok(
        !src.includes('CRON_SECRET is not configured'),
        `${route}: still returns the 500 config-state leak`,
      );
      assert.ok(
        src.includes('requireCronAuth(req)'),
        `${route}: does not use the shared requireCronAuth helper`,
      );
    }
  });
});
