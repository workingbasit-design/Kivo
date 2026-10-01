/**
 * Test-only resolve hook for the customer-agent-keys test: redirects
 * `@/lib/prisma` to the in-memory stub (no database). Registered from
 * inside the test file, so it only affects that test's process.
 */
const stubUrl = new URL('./customer-agent-keys-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === '@/lib/prisma' ||
    specifier.endsWith('/lib/prisma') ||
    specifier.endsWith('/lib/prisma.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
