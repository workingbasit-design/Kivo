/**
 * Resolve hook for the D1 team-invite test: redirects the prisma /
 * tenant-guard / auth imports of team-invite.ts (and membership.ts,
 * which it imports) to the shared in-memory stub.
 */
const stubUrl = new URL('./team-invite-stub.mjs', import.meta.url).href;

const STUBBED = new Set(['@/lib/prisma', '@/lib/auth']);

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return { url: stubUrl, shortCircuit: true };
  }
  const parent = context.parentURL ?? '';
  if (
    (specifier === './prisma.ts' ||
      specifier === './prisma.js' ||
      specifier === './tenant-guard.ts' ||
      specifier === './tenant-guard.js') &&
    (parent.includes('/src/lib/team-invite.ts') ||
      parent.includes('/src/lib/membership.ts'))
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
