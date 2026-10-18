/**
 * FIX-NOW S2: resolve hook for dashboard-layout-reorder.test.mts.
 * Redirects the framework/data modules on the save path to the in-memory
 * stub (dashboard-layout-reorder-stub.mjs). The real lib, the real server
 * action and zod resolve normally - they are what's under test.
 */
const stubUrl = new URL('./dashboard-layout-reorder-stub.mjs', import.meta.url).href;

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
