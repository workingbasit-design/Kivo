/**
 * Minimal next/* stubs for attacker-gaps.test.mts.
 * next/server: NextResponse.json (used by csrf.ts's originForbidden).
 * next/headers, next/navigation: empty (imported but unused on these paths).
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server' || specifier === 'next/headers' || specifier === 'next/navigation') {
    return {
      url: new URL('./next-server-stub.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
