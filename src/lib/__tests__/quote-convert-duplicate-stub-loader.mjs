/**
 * Resolve hook for the quote duplicate-conversion regression tests:
 * redirects @/lib/prisma, @/lib/auth, next/cache, next/headers and
 * next/navigation to the in-memory stub.
 */
const stubUrl = new URL('./quote-convert-duplicate-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  '@/lib/prisma',
  '@/lib/auth',
  'next/cache',
  'next/headers',
  'next/navigation',
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
