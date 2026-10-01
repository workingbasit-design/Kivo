/** Loader: stub DB-touching modules for concierge action tests.
 * Registered from inside the test file only. */
const STUB_URL = new URL('./concierge-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  '@/lib/prisma',
  '@/lib/customer-auth',
  '@/lib/tenant-guard',
]);

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return { url: STUB_URL, shortCircuit: true };
  }
  // Relative `./directory` import from the concierge action (send path never
  // calls findDirectoryMatches; the stub returns []).
  if (
    (specifier === './directory' || specifier === './directory.ts') &&
    context.parentURL.includes('/app/actions/concierge.ts')
  ) {
    return { url: STUB_URL, shortCircuit: true };
  }
  if (
    specifier.endsWith('/lib/prisma.ts') ||
    specifier.endsWith('/lib/customer-auth.ts') ||
    specifier.endsWith('/lib/tenant-guard.ts')
  ) {
    return { url: STUB_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
