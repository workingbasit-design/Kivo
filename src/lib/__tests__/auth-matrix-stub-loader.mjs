/**
 * Resolve hook for the auth-matrix tests: stubs @/lib/prisma and @/lib/auth
 * with persona-configurable sessions. The REAL src/lib/membership.ts is used
 * (that's what's under test).
 */
const stubUrl = new URL('./auth-matrix-stub.mjs', import.meta.url).href;

const STUBBED = new Set(['@/lib/prisma', '@/lib/auth', 'next/navigation']);

export async function resolve(specifier, context, nextResolve) {
  if (
    STUBBED.has(specifier) ||
    specifier === './prisma.ts' ||
    specifier.endsWith('/lib/prisma.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
