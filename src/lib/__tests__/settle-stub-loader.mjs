/**
 * Resolve hook for the settle-job-paid tests: redirects @/lib/prisma,
 * @/lib/auth, next/cache and next/navigation to the in-memory stub.
 */
const stubUrl = new URL('./settle-stub.mjs', import.meta.url).href;

const STUBBED = new Set(['@/lib/prisma', '@/lib/auth', 'next/cache', 'next/navigation', 'next/headers']);

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
