/**
 * Test-only resolve hook for the reviews-moat test (registered from inside
 * that test file, so it only affects its subprocess). Redirects the
 * server-action dependencies to the in-memory stub:
 *   @/lib/prisma, @/lib/auth, @/lib/rate-limit, @/lib/directory, next/cache
 * Everything else delegates to the next resolver in the chain.
 */

const stubUrl = new URL('./reviews-moat-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  '@/lib/prisma',
  '@/lib/prisma.ts',
  '@/lib/auth',
  '@/lib/auth.ts',
  '@/lib/rate-limit',
  '@/lib/rate-limit.ts',
  '@/lib/directory',
  '@/lib/directory.ts',
  'next/cache',
]);

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
