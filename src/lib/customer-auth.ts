import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { DatabaseUnavailableError } from './db-errors';
import { customerSessionCookieName, newSessionId } from './session-cookie.ts';
import crypto from 'crypto';

const COOKIE_NAME = customerSessionCookieName();
const SESSION_DAYS = 30;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyCustomerPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
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
