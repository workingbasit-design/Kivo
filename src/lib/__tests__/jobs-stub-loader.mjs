/**
 * Resolve hook for the mark-paid wiring tests.
 */
const stubUrl = new URL('./jobs-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === '@/lib/prisma' ||
    specifier === '@/lib/auth' ||
    specifier === '@/lib/validations' ||
    specifier === '@/lib/job-status' ||
    specifier === '@/lib/phone' ||
    specifier === '@/lib/rate-limit' ||
    specifier === 'next/cache' ||
    specifier === 'next/navigation' ||
    specifier === './invoices' ||
    specifier.endsWith('/lib/prisma.ts') ||
    specifier.endsWith('/lib/auth.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
