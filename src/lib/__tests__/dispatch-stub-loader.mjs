/**
 * Resolve hook for the dispatch tenant-scope tests: redirects @/lib/prisma,
 * @/lib/auth and next/cache to the in-memory stub.
 */
const stubUrl = new URL('./dispatch-stub.mjs', import.meta.url).href;

const STUBBED = new Set(['@/lib/prisma', '@/lib/auth', 'next/cache']);

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
