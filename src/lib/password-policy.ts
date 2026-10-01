/**
 * Shared password-length policy. Pure — no Next.js imports, safe for unit tests.
 *
 * Passwords longer than the cap are rejected BEFORE hashing: hashing runs
 * PBKDF2-SHA512 100k iterations synchronously, so an unbounded input on an
 * unauthenticated endpoint would burn CPU and block the event loop (DoS).
 * The cap applies to customer signup, customer login (cheap verify even for
 * accounts created before the cap existed), and the pro side alike.
 */
export const MAX_PASSWORD_LENGTH = 128;

export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordLengthAcceptable(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

/** True when the password must be rejected for being too long (the DoS cap). */
export function isPasswordTooLong(password: string): boolean {
  return password.length > MAX_PASSWORD_LENGTH;
}
