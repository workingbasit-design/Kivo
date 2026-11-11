/**
 * Resolve hook for the session-security tests: redirects framework and
 * data modules to the in-memory stub. The REAL @/lib/auth,
 * @/lib/customer-auth, @/lib/session-cookie, @/lib/stripe and
 * @/lib/jsonld resolve normally - those are what's under test.
 */
const stubUrl = new URL('./session-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  'next/headers',
  'next/navigation',
  '@/lib/prisma',
  '@/lib/membership',
  '@/lib/db-errors',
]);

const STUBBED_SUFFIXES = [
  '/lib/prisma.ts',
  '/lib/prisma',
  '/lib/membership.ts',
  '/lib/membership',
  '/lib/db-errors.ts',
  '/lib/db-errors',
];

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return { url: stubUrl, shortCircuit: true };
  }
  let resolved = specifier;
  try {
    resolved = new URL(specifier, context.parentURL).href;
  } catch {
    // Not a resolvable URL (e.g. a bare builtin) - pass through.
  }
  if (STUBBED_SUFFIXES.some((s) => resolved.endsWith(s))) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
