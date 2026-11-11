/**
 * Session cookie names + session id generation (security audit F1/F7,
 * 2026-11-11).
 *
 * In production the cookies carry the `__Host-` prefix: it binds the
 * cookie to the host + Secure + path=/ and blocks subdomain cookie
 * injection. The prefix requires Secure, so local dev (plain http) keeps
 * the unprefixed name — a `__Host-` cookie without Secure is rejected
 * by the browser and nobody could sign in locally.
 *
 * Pure module (no imports): `src/proxy.ts` imports the names, and the
 * proxy must stay free of Node-only dependencies.
 */

/** Business (pro) session cookie name. */
export function sessionCookieName(
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  return nodeEnv === 'production' ? '__Host-kivo_session' : 'kivo_session';
}

/** Customer-portal session cookie name. */
export function customerSessionCookieName(
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  return nodeEnv === 'production'
    ? '__Host-kivo_customer_session'
    : 'kivo_customer_session';
}

/**
 * 256-bit session id: 32 CSPRNG bytes as 64 hex chars (F1). The old
 * ids were Prisma `cuid()` defaults (~41 bits of unknown entropy, with
 * the timestamp embedded in the id itself). Uses WebCrypto so this
 * module stays runnable in Node and edge runtimes alike.
 */
export function newSessionId(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
