/**
 * Resolve hook for the imports commit tests: redirects @/lib/prisma,
 * @/lib/auth, next/cache, and @/lib/i18n/server to the in-memory stub.
 */
const stubUrl = new URL('./imports-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  '@/lib/prisma',
  '@/lib/auth',
  '@/lib/i18n/server',
  'next/cache',
]);

export async function resolve(specifier, context, nextResolve) {
  if (
    STUBBED.has(specifier) ||
    specifier.endsWith('/lib/prisma.ts') ||
    specifier.endsWith('/lib/auth.ts') ||
    specifier.endsWith('/lib/i18n/server.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
