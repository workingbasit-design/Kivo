/**
 * Resolve hook for the B1.2 role matrix test.
 */
const stubUrl = new URL('./role-matrix-stub.mjs', import.meta.url).href;

const STUBBED = new Set(['@/lib/auth', '@/lib/prisma']);

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return { url: stubUrl, shortCircuit: true };
  }
  // membership.ts imports './prisma.ts' relatively - stub that too.
  if (
    (specifier === './prisma.ts' || specifier === './prisma.js') &&
    context.parentURL?.includes('/src/lib/membership.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
