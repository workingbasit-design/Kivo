/**
 * Test-only resolve hook for the job-start-time test (registered from inside
 * that test file, so it only affects its subprocess). Redirects the
 * server-action dependencies to the in-memory stub:
 *   @/lib/prisma, @/lib/auth, @/lib/rate-limit, @/lib/logger,
 *   next/cache, next/navigation
 * plus the COMPLETED branch's dynamic imports (@/lib/scheduled-invoices,
 * @/lib/webhooks) so no code path ever leaves the stub world (the real
 * scheduled-invoices module imports prisma via a relative specifier, so
 * stubbing @/lib/prisma alone does not cover it).
 * Everything else delegates to the next resolver in the chain.
 */

const stubUrl = new URL('./job-start-time-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  '@/lib/prisma',
  '@/lib/prisma.ts',
  '@/lib/auth',
  '@/lib/auth.ts',
  '@/lib/rate-limit',
  '@/lib/rate-limit.ts',
  '@/lib/logger',
  '@/lib/logger.ts',
  '@/lib/scheduled-invoices',
  '@/lib/scheduled-invoices.ts',
  '@/lib/webhooks',
  '@/lib/webhooks.ts',
  'next/cache',
  'next/navigation',
]);

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
