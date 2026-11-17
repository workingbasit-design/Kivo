import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma.ts';
import { DatabaseUnavailableError } from './db-errors.ts';
import { customerSessionCookieName, newSessionId } from './session-cookie.ts';
import crypto from 'crypto';
import { promisify } from 'node:util';

const COOKIE_NAME = customerSessionCookieName();
const SESSION_DAYS = 30;

// PBKDF2 params (unchanged from the sync version, so every stored hash keeps
// verifying): 100k iterations, SHA-512, 64-byte output, `salt:hash` hex
// format. Async since P1.0 (S7): the sync version blocked the Node event
// loop for the full hash duration on unauthenticated endpoints.
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LEN = 64;
const PBKDF2_DIGEST = 'sha512';
const pbkdf2Async = promisify(crypto.pbkdf2);

// S6 dummy hash: a well-formed `salt:hash` value (generated once with the
// real hash function, password 'dummy') that no account stores. The login
// path verifies against it for non-existent emails so the timing matches a
// real login instead of short-circuiting (email-existence oracle).
export const DUMMY_CUSTOMER_HASH =
  '1b7441f57320ecf6efd7d34a903babf1:871266671f210956dd05248f527858dbd621f96fecced87f844d2dfa43b9d3481dac5f8d0bfac98f1860622d22d9f2c316b005797b293059837d6515c037ad69';

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (
    await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST)
  ).toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyCustomerPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = (
    await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST)
  ).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(check);
  // A malformed/short stored hash must fail closed, not throw RangeError
  // from timingSafeEqual (which would turn a login into a 500).
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { hashPassword as hashCustomerPassword };

export async function createCustomerSession(customerId: string) {
  await prisma.customerSession
    .deleteMany({ where: { customerId, expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.customerSession.create({
    // F1 (security audit 2026-11-11): explicit 256-bit id, same as the
    // business session — never let a session id come from cuid().
    data: { id: newSessionId(), customerId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });

  return session;
}

export async function getCustomerSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  let session;
  try {
    session = await prisma.customerSession.findUnique({
      where: { id: sessionId },
      include: { customer: true },
    });
  } catch {
    throw new DatabaseUnavailableError();
  }

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.customerSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

export async function requireCustomerAuth() {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');
  return session;
}

export async function destroyCustomerSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (sessionId) {
    await prisma.customerSession.delete({ where: { id: sessionId } }).catch(() => {});
  }
  cookieStore.delete(COOKIE_NAME);
}
