/**
 * Google sign-in (OIDC) for EveryJob — Track 7.
 *
 * "Continue with Google" reuses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 * Identity is established by verifying the RS256-signed ID token against
 * Google's certs (never by trusting the email claim alone), and accounts
 * are linked only by a verified Google email — never creating a duplicate
 * user/business for an existing email.
 *
 * Pure functions take an injected fetch so they are unit-testable with
 * mocked HTTP; no live Google calls in tests.
 */

import crypto from 'crypto';

export const GOOGLE_OIDC_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OIDC_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_OIDC_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_OIDC_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
export const GOOGLE_SIGNIN_SCOPES = ['openid', 'email', 'profile'];

/** Secure random base64url string for OAuth state / OIDC nonce. */
export function randomOAuthValue(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Build the Google sign-in authorization URL (OIDC, online access). */
export function buildGoogleSignInUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
}): string {
  const p = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SIGNIN_SCOPES.join(' '),
    state: opts.state,
    nonce: opts.nonce,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_OIDC_AUTH_URL}?${p.toString()}`;
}

/**
 * Allow only same-origin relative paths for post-login redirects.
 * Anything else (absolute URLs, protocol-relative, empty) falls back.
 */
export function safeRedirectPath(to: string | null | undefined, fallback = '/dashboard'): string {
  if (!to || typeof to !== 'string') return fallback;
  if (!to.startsWith('/')) return fallback;
  if (to.startsWith('//')) return fallback;
  if (to.includes('\\')) return fallback;
  return to;
}

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

export type TokenVerifyError =
  | 'bad_format'
  | 'bad_signature'
  | 'unknown_key'
  | 'bad_issuer'
  | 'bad_audience'
  | 'expired'
  | 'bad_nonce'
  | 'email_unverified'
  | 'certs_fetch_failed';

export type TokenVerifyResult =
  | { ok: true; claims: GoogleIdTokenClaims }
  | { ok: false; error: TokenVerifyError };

type Jwk = { kid?: string; kty?: string; n?: string; e?: string };

function base64UrlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Minimal JWKS cache: Google rotates certs infrequently; cache for 1 hour. */
let certsCache: { fetchedAt: number; keys: Jwk[] } | null = null;
const CERTS_TTL_MS = 60 * 60 * 1000;

export function clearGoogleCertsCache(): void {
  certsCache = null;
}

async function getGoogleCerts(
  fetchImpl: typeof fetch
): Promise<{ ok: true; keys: Jwk[] } | { ok: false }> {
  if (certsCache && Date.now() - certsCache.fetchedAt < CERTS_TTL_MS) {
    return { ok: true, keys: certsCache.keys };
  }
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_OIDC_CERTS_URL);
  } catch {
    return { ok: false };
  }
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  certsCache = { fetchedAt: Date.now(), keys };
  return { ok: true, keys };
}

/**
 * Verify a Google ID token: RS256 signature against Google's published
 * certs, then issuer / audience / expiry / nonce / email_verified claims.
 */
export async function verifyGoogleIdToken(opts: {
  idToken: string;
  clientId: string;
  expectedNonce: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenVerifyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const parts = opts.idToken.split('.');
  if (parts.length !== 3) return { ok: false, error: 'bad_format' };

  let header: { kid?: string; alg?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlToBuffer(parts[0]).toString('utf8'));
    payload = JSON.parse(base64UrlToBuffer(parts[1]).toString('utf8'));
  } catch {
    return { ok: false, error: 'bad_format' };
  }
  if (header.alg !== 'RS256' || !header.kid) return { ok: false, error: 'bad_signature' };

  const certs = await getGoogleCerts(fetchImpl);
  if (!certs.ok) return { ok: false, error: 'certs_fetch_failed' };
  const jwk = certs.keys.find((k) => k.kid === header.kid && k.kty === 'RSA' && k.n && k.e);
  if (!jwk) return { ok: false, error: 'unknown_key' };

  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({
      key: jwk as unknown as crypto.JsonWebKey,
      format: 'jwk',
    });
  } catch {
    return { ok: false, error: 'bad_signature' };
  }
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBuffer(parts[2]);
  if (!verifier.verify(publicKey, signature)) {
    return { ok: false, error: 'bad_signature' };
  }

  // Claims.
  const iss = payload.iss as string | undefined;
  if (!iss || !GOOGLE_OIDC_ISSUERS.includes(iss)) return { ok: false, error: 'bad_issuer' };
  if (payload.aud !== opts.clientId) return { ok: false, error: 'bad_audience' };
  const exp = payload.exp as number | undefined;
  // 60s clock-skew leeway.
  if (typeof exp !== 'number' || exp * 1000 < Date.now() - 60_000) {
    return { ok: false, error: 'expired' };
  }
  if (payload.nonce !== opts.expectedNonce) return { ok: false, error: 'bad_nonce' };
  const email = payload.email as string | undefined;
  if (!email || payload.email_verified !== true) {
    return { ok: false, error: 'email_unverified' };
  }
  const sub = payload.sub as string | undefined;
  if (!sub) return { ok: false, error: 'bad_format' };

  return {
    ok: true,
    claims: {
      sub,
      email,
      emailVerified: true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    },
  };
}

export type TokenExchangeResult =
  | { ok: true; idToken: string }
  | { ok: false; error: string };

/** Exchange an authorization code for tokens at Google's token endpoint. */
export async function exchangeCodeForTokens(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenExchangeResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_OIDC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: opts.code,
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        redirect_uri: opts.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }
  if (!res.ok) return { ok: false, error: `token_exchange_${res.status}` };
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return { ok: false, error: 'missing_id_token' };
  return { ok: true, idToken: data.id_token };
}

/* ------------------------------------------------------------------ */
/* Account resolution: link by verified email, never duplicate.         */
/* ------------------------------------------------------------------ */

export type ExistingAccount = { id: string } | null;

export type AccountResolution =
  | { action: 'login'; userId: string }
  | { action: 'link'; userId: string }
  | { action: 'create' }
  | { action: 'error'; reason: 'email_unverified' };

/**
 * Decide what a verified Google identity means for our user table.
 * - googleId match      → log in (returning Google user)
 * - verified email match → link this googleId onto the existing user, log in
 * - neither              → create a fresh user + business tenant
 * Linking happens only on verified emails, so an attacker can't claim
 * someone else's address.
 */
export function resolveGoogleAccount(
  claims: { sub: string; email: string; emailVerified: boolean },
  byGoogleId: ExistingAccount,
  byEmail: ExistingAccount
): AccountResolution {
  if (!claims.emailVerified) return { action: 'error', reason: 'email_unverified' };
  if (byGoogleId) return { action: 'login', userId: byGoogleId.id };
  if (byEmail) return { action: 'link', userId: byEmail.id };
  return { action: 'create' };
}

/* ------------------------------------------------------------------ */
/* Canadian (NANP) contact-number validation.                          */
/* ------------------------------------------------------------------ */

export type PhoneValidation =
  | { ok: true; digits: string; display: string } // digits: 11-digit E.164 without '+'
  | { ok: false; errorKey: 'phoneRequired' | 'phoneInvalid' };

/**
 * Validate a Canadian contact number. Accepts common formatting
 * ("(416) 555-1234", "416-555-1234", "+1 416 555 1234") and normalizes to
 * E.164 digits (1 + 10-digit NANP). Rejects NANP-invalid area/exchange
 * codes (they can't start with 0/1) and anything that isn't 10 digits.
 */
export function validateCanadianPhone(input: string | null | undefined): PhoneValidation {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, errorKey: 'phoneRequired' };
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return { ok: false, errorKey: 'phoneInvalid' };
  }
  const display = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return { ok: true, digits: `1${digits}`, display };
}
