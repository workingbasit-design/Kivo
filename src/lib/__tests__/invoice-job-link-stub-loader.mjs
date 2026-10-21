/**
 * Resolve hook for the D4 invoice-job-link tests: redirects @/lib/prisma,
 * @/lib/auth, next/cache, next/navigation and next/headers to the
 * in-memory stub (same pattern as settle-stub-loader.mjs).
 */
const stubUrl = new URL('./invoice-job-link-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  '@/lib/prisma',
  '@/lib/auth',
  'next/cache',
  'next/navigation',
  'next/headers',
]);

export async function resolve(specifier, context, nextResolve) {
  if (
    STUBBED.has(specifier) ||
    specifier.endsWith('/lib/prisma.ts') ||
    specifier.endsWith('/lib/auth.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
