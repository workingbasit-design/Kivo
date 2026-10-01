/**
 * Test-only resolve hook for the customer-requests consent test: redirects
 * `@/lib/prisma`, `@/lib/customer-auth`, and `next/navigation` to the
 * in-memory stub. Registered from inside the test file only.
 */
const stubUrl = new URL('./customer-requests-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === '@/lib/prisma' ||
    specifier.endsWith('/lib/prisma') ||
    specifier.endsWith('/lib/prisma.ts') ||
    specifier === '@/lib/customer-auth' ||
    specifier.endsWith('/lib/customer-auth') ||
    specifier.endsWith('/lib/customer-auth.ts') ||
    specifier === 'next/navigation'
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
