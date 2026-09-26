'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession, destroySession, getSession, requireAuth } from '@/lib/auth';
import { loginSchema, registerSchema } from '@/lib/validations';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { sendPlatformEmail } from '@/lib/messaging/platform-email';
import { validateCanadianPhone } from '@/lib/google-auth';
import { revalidatePath } from 'next/cache';

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
      regionCode: 'CA',
      // Canada-only defaults.
      currency: 'CAD',
      timezone: 'America/Toronto',
      users: {
        create: { name, email, passwordHash, role: 'ADMIN' },
      },
    },
    include: { users: true },
  });

  const owner = business.users[0];
  await createSession(owner.id);

  // Best-effort welcome email (platform Resend key, free tier). A missing
  // RESEND_API_KEY only skips the email — signup must never fail because
  // of it.
  try {
    const locale = await getLocale();
    await sendPlatformEmail(
      owner.email,
      t(locale, 't10misc.auth.welcomeEmailSubject'),
      t(locale, 't10misc.auth.welcomeEmailBody')
        .replace('{name}', name)
        .replace('{business}', businessName),
      { fromName: 'EveryJob' }
    );
  } catch {
    // ignore — the account is already created and the user is signed in
  }

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

/* ------------------------------------------------------------------ */
/* Track 7 — Google sign-in onboarding + profile.                      */
/* ------------------------------------------------------------------ */

/**
 * Save the Canadian contact number from the post-Google-signup welcome
 * prompt. Phone is required here — the form has a separate "Skip for now".
 */
export async function saveWelcomePhone(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const locale = await getLocale();

  const raw = String(formData.get('phone') ?? '').trim();
  if (!raw) {
    return { error: t(locale, 'googleAuth.phoneRequired') };
  }
  const check = validateCanadianPhone(raw);
  if (!check.ok) {
    return { error: t(locale, `googleAuth.${check.errorKey}`) };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone: check.digits, phonePrompted: true },
  });
  redirect('/dashboard');
}

/** Skip the welcome contact-number prompt (still marked as prompted). */
export async function skipWelcomePhone(): Promise<void> {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  await prisma.user.update({
    where: { id: session.user.id },
    data: { phonePrompted: true },
  });
  redirect('/dashboard');
}

/** Update the signed-in user's own name + Canadian contact number. */
export async function updateProfile(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const { user } = await requireAuth();
  const locale = await getLocale();

  const name = String(formData.get('name') ?? '').trim().slice(0, 100);
  const rawPhone = String(formData.get('phone') ?? '').trim();

  let phone: string | null = null;
  if (rawPhone) {
    const check = validateCanadianPhone(rawPhone);
    if (!check.ok) {
      return { error: t(locale, `googleAuth.${check.errorKey}`) };
    }
    phone = check.digits;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: name || null, phone },
  });
  revalidatePath('/settings');
  return { ok: true };
}
