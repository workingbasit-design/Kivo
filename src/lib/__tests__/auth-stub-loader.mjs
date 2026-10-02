/**
 * Resolve hook for the auth rate-limit tests: redirects framework and
 * data modules to the in-memory stub. Pure modules (validations,
 * rate-limit, password-policy, password-reset, client-ip, zod) resolve
 * normally — the real rate limiter is what's under test.
 */
const stubUrl = new URL('./auth-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  'next/headers',
  'next/navigation',
  'next/cache',
  'bcryptjs',
  '@/lib/prisma',
  '@/lib/auth',
  '@/lib/customer-auth',
  '@/lib/i18n/server',
  '@/lib/i18n',
  '@/lib/messaging/platform-email',
  '@/lib/messaging/email-templates',
  '@/lib/google-auth',
  '@/lib/app-url',
]);

export async function resolve(specifier, context, nextResolve) {
  if (
    STUBBED.has(specifier) ||
    specifier.endsWith('/lib/prisma.ts') ||
    specifier.endsWith('/lib/auth.ts') ||
    specifier.endsWith('/lib/customer-auth.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
