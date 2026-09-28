/**
 * Public route table for the auth proxy (src/proxy.ts).
 *
 * Pure module with no Next.js imports so it can be unit-tested under plain
 * node --test. The proxy imports isPublicPath() from here.
 *
 * A route missing from this table bounces anonymous users to /login.
 * On 2026-09-28 QA found /forgot-password missing, which made the entire
 * password-reset flow unreachable (the emailed /reset-password/[token] link
 * bounced too), and /terms + /privacy bounced even though the register page
 * links to them.
 */

export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/terms',
  '/privacy',
];

// Public client-facing routes: online booking + magic-link portals (unguessable ids)
// + the EveryJob business directory (customer discovery layer).
// '/sign/' must stay public: unauthenticated clients open signing links
// with no login, and bouncing them to /login would break the feature.
// '/track/' must stay public: customers open technician tracking links
// with no account — the unguessable token is the only capability.
// '/reset-password/' must stay public: the emailed reset link is opened by
// logged-out users; bouncing them to /login would break password recovery.
export const PUBLIC_PREFIXES = [
  '/book/',
  '/q/',
  '/i/',
  '/r/',
  '/p/',
  '/portal/',
  '/sign/',
  '/track/',
  '/rev/',
  '/reset-password/',
];

export const PUBLIC_EXACT_EXTRA = ['/directory', '/directory/request'];

/** Is this pathname reachable without a session? */
export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_EXACT_EXTRA.some((p) => pathname === p) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  );
}
