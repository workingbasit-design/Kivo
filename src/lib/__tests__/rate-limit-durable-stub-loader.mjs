/**
 * Resolve hook for the durable rate-limiter tests: redirects @/lib/prisma
 * to the in-memory stub (rate-limit-durable-stub.mjs). The REAL
 * src/lib/rate-limit-durable.ts is what's under test.
 */
const stubUrl = new URL('./rate-limit-durable-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma' || specifier.endsWith('/lib/prisma.ts')) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
