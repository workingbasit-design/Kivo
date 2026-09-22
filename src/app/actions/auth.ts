'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession, destroySession } from '@/lib/auth';
import { loginSchema, registerSchema } from '@/lib/validations';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';

export type AuthResult = { error?: string; ok?: boolean };

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function tooMany(ret: { retryAfterMs: number }): AuthResult {
  const secs = Math.max(1, Math.ceil(ret.retryAfterMs / 1000));
  return {
    error: `Too many attempts. Please try again in ${secs} second${secs === 1 ? '' : 's'}.`,
  };
}

/**
 * Register a new business + owner account.
 * Creates: Business -> User (ADMIN) -> Session cookie.
 */
export async function register(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const rl = rateLimit(await clientKey('register'), AUTH_LIMIT);
  if (!rl.ok) return tooMany(rl);

  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    businessName: formData.get('businessName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }
  const { name, businessName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'An account with this email already exists. Try logging in.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const business = await prisma.business.create({
    data: {
      name: businessName,
      regionCode: 'IN',
      users: {
        create: { name, email, passwordHash, role: 'ADMIN' },
      },
    },
    include: { users: true },
  });

  const owner = business.users[0];
  await createSession(owner.id);
  redirect('/dashboard');
}

/**
 * Log in with email + password.
 */
export async function login(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const rl = rateLimit(await clientKey('login'), AUTH_LIMIT);
  if (!rl.ok) return tooMany(rl);

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }
  const { email, password } = parsed.data;

  // Always hash-compare to keep timing consistent-ish, even for unknown emails.
  const user = await prisma.user.findUnique({ where: { email } });
  const hash = user?.passwordHash ?? (await bcrypt.hash('dummy', 4));
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok || !user.businessId) {
    return { error: 'Incorrect email or password.' };
  }

  await createSession(user.id);
  redirect('/dashboard');
}

/** Log out everywhere for this session. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}
