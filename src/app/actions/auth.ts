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
import { welcomeEmail } from '@/lib/messaging/email-templates';
import { validateCanadianPhone } from '@/lib/google-auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { revalidatePath } from 'next/cache';

export type AuthResult = {
  error?: string;
  ok?: boolean;
  /** B7.4: set when the password step passed but a TOTP code is still needed. */
  totpRequired?: boolean;
  challenge?: string;
};

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

  // B11.1: honeypot + fill-time bot check on business signup.
  const { botCheckFailed } = await import('@/lib/bot-check');
  if (botCheckFailed(formData)) {
    return { error: 'Please try again.' };
  }

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

  // Per-email bucket alongside the per-IP one: without it, one account's
  // signup could be retried indefinitely by rotating IPs.
  const rlEmail = rateLimit(`register-email:${email}`, AUTH_LIMIT);
  if (!rlEmail.ok) return tooMany(rlEmail);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'An account with this email already exists. Try logging in.' };
  }

  // B7.3a: reject passwords known to be breached (HIBP k-anonymity - the
  // password never leaves the server). Fail-open on HIBP outage.
  const { isPasswordBreached } = await import('@/lib/breached-passwords');
  const breach = await isPasswordBreached(password);
  if (breach.breached) {
    return { error: 'This password has appeared in a data breach. Please choose a different one.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const business = await prisma.business.create({
    data: {
      name: businessName,
      regionCode: 'CA',
      // Canada-only defaults.
      currency: 'CAD',
      timezone: 'America/Toronto',
    },
  });

  // M9: role + business assignment live on Membership, not the User row.
  const owner = await prisma.user.create({
    data: { name, email, passwordHash },
  });
  await prisma.membership.create({
    data: {
      userId: owner.id,
      businessId: business.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  await createSession(owner.id);

  // Best-effort welcome email (platform Resend key, free tier). A missing
  // RESEND_API_KEY only skips the email - signup must never fail because
  // of it.
  try {
    const tpl = welcomeEmail(name, businessName);
    await sendPlatformEmail(owner.email, tpl.subject, tpl.text, {
      fromName: 'EveryJob',
      htmlBody: tpl.html,
    });
  } catch {
    // ignore - the account is already created and the user is signed in
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

  // Per-email bucket alongside the per-IP one: this is the credential-
  // stuffing defense. An attacker rotating IPs still can't hammer one
  // account's password beyond the limit.
  const rlEmail = rateLimit(`login-email:${email}`, AUTH_LIMIT);
  if (!rlEmail.ok) return tooMany(rlEmail);

  // Always hash-compare to keep timing consistent-ish, even for unknown emails.
  const user = await prisma.user.findUnique({ where: { email } });
  const hash = user?.passwordHash ?? (await bcrypt.hash('dummy', 4));
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    // B9.2: feed the brute-force alert (IP only - the email is hashed, never stored).
    const { headers } = await import('next/headers');
    const { clientIpFromHeaders } = await import('@/lib/client-ip');
    const { reportLoginFailure } = await import('@/lib/error-log');
    try {
      const ip = clientIpFromHeaders(await headers());
      await reportLoginFailure(ip ?? 'unknown', email);
    } catch {
      // alerting must never break login
    }
    return { error: 'Incorrect email or password.' };
  }

  // M9: no User.businessId anymore — a login is only valid with an ACTIVE
  // membership (same generic error either way: no account-oracle).
  const membership = await getActiveMembershipForUser(user.id);
  if (!membership) {
    return { error: 'Incorrect email or password.' };
  }

  // B7.4: users with TOTP enabled finish a second factor before any session
  // exists. The password step issues a short-lived signed challenge; the
  // code step (verifyTotpLogin) creates the session.
  if (user.totpEnabled) {
    const { signTotpChallenge } = await import('@/lib/totp');
    return { totpRequired: true, challenge: signTotpChallenge(user.id) };
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
/* Track 7 - Google sign-in onboarding + profile.                      */
/* ------------------------------------------------------------------ */

/**
 * Save the Canadian contact number from the post-Google-signup welcome
 * prompt. Phone is required here - the form has a separate "Skip for now".
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
