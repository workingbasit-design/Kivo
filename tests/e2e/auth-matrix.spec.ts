/**
 * P4-A-002 — Authorization matrix: every API route × 7 personas (HTTP).
 *
 * Expected verdicts come from tests/auth-matrix/matrix.json (human-reviewed).
 * This spec asserts the AUTH boundary, not functionality:
 *   allow -> status is NOT 401/403 (404/400/429/500 are functional, not auth)
 *   deny  -> status IS 401/403/404/302/307 (rejected for auth)
 *
 * Runs on desktop only (auth logic is device-independent).
 * Needs: seeded test DB + running app (CI).
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loginAs } from './fixtures';

/** Matrix personas (auth-matrix keys; 'anonymous' never logs in). */
type MatrixPersona = 'anonymous' | 'consumer' | 'ownerA' | 'adminA' | 'dispatcherA' | 'technicianA' | 'ownerB';

interface MatrixEntry {
  type: string;
  path: string;
  methods: string[];
  expected: Record<string, string>;
}

const matrix = JSON.parse(readFileSync('tests/auth-matrix/matrix.json', 'utf8')) as {
  personas: MatrixPersona[];
  entries: MatrixEntry[];
};
const routes = matrix.entries.filter((e) => e.type === 'route');

const PERSONAS: MatrixPersona[] = ['anonymous', 'consumer', 'ownerA', 'adminA', 'dispatcherA', 'technicianA', 'ownerB'];

let contexts: Record<MatrixPersona, BrowserContext>;

test.beforeAll(async ({ browser }) => {
  contexts = {} as Record<MatrixPersona, BrowserContext>;
  for (const persona of PERSONAS) {
    const ctx = await browser.newContext();
    if (persona !== 'anonymous') {
      const page = await ctx.newPage();
      await loginAs(page, toLoginPersona(persona));
      await page.close();
    }
    contexts[persona] = ctx;
  }
});

test.afterAll(async () => {
  for (const ctx of Object.values(contexts)) await ctx.close();
});

/** Map matrix persona -> fixtures login persona. */
function toLoginPersona(p: MatrixPersona): 'ownerA' | 'adminA' | 'dispatcherA' | 'technicianA' | 'ownerB' | 'consumer1' {
  if (p === 'consumer') return 'consumer1';
  return p as 'ownerA' | 'adminA' | 'dispatcherA' | 'technicianA' | 'ownerB';
}

function fillParams(path: string): string {
  return path
    .replace('[id]', 'p4a-bogus-id')
    .replace('[token]', 'p4a-bogus-token')
    .replace('[slug]', 'p4a-bogus-slug');
}

for (const route of routes) {
  for (const persona of PERSONAS) {
    const verdict = route.expected[persona];
    test(`P4-A-002 ${route.path} [${route.methods.join(',')}] as ${persona} -> ${verdict}`, async () => {
      const ctx = contexts[persona];
      const url = fillParams(route.path);
      for (const method of route.methods) {
        const res = await ctx.request.fetch(url, {
          method,
          data: method === 'GET' ? undefined : {},
          headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
        });
        const status = res.status();
        if (verdict === 'allow') {
          expect(status, `${persona} ${method} ${url}: expected auth pass, got ${status}`).not.toBe(401);
          expect(status, `${persona} ${method} ${url}: expected auth pass, got ${status}`).not.toBe(403);
        } else if (verdict === 'deny') {
          expect(
            [401, 403, 404, 302, 307].includes(status),
            `${persona} ${method} ${url}: expected auth reject, got ${status}`,
          ).toBe(true);
        } else {
          throw new Error(`unexpected verdict ${verdict}`);
        }
        await res.dispose();
      }
    });
  }
}
