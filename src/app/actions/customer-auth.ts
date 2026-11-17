'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  createCustomerSession,
  destroyCustomerSession,
  hashCustomerPassword,
  verifyCustomerPassword,
  DUMMY_CUSTOMER_HASH,
} from '@/lib/customer-auth';
import { isPasswordTooLong, MAX_PASSWORD_LENGTH } from '@/lib/password-policy';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function tooMany(): { error: string } {
  return { error: 'Too many attempts. Please try again later.' };
}

export async function customerSignup(_prev: unknown, formData: FormData) {
  const rl = rateLimit(await clientKey('customer-signup'), AUTH_LIMIT);
  if (!rl.ok) return tooMany();

  // B11.1: honeypot + fill-time bot check on customer signup.
  const { botCheckFailed } = await import('@/lib/bot-check');
  if (botCheckFailed(formData)) {
    return { error: 'Please try again.' };
  }

  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const phone = String(formData.get('phone') || '').trim();
  const city = String(formData.get('city') || '').trim();

  if (!name) return { error: 'Please enter your name.' };
  if (!isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  // Cap password length: hashing runs PBKDF2-SHA512 100k iterations, so an
  // unbounded input on this unauthenticated endpoint would burn CPU (async
  // since P1.0, but the cap stays as defence-in-depth).
  if (isPasswordTooLong(password)) return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };

  const existing = await prisma.customerUser.findUnique({ where: { email } }).catch(() => null);
  if (existing) return { error: 'An account with this email already exists. Please log in.' };

  // B7.3a: reject breached passwords (fail-open on HIBP outage).
  const { isPasswordBreached } = await import('@/lib/breached-passwords');
  const breach = await isPasswordBreached(password);
  if (breach.breached) {
    return { error: 'This password has appeared in a data breach. Please choose a different one.' };
  }

  const customer = await prisma.customerUser.create({
    data: {
      name,
      email,
      passwordHash: await hashCustomerPassword(password),
      phone: phone || null,
      city: city || null,
    },
  });

  await createCustomerSession(customer.id);
  redirect('/customer');
}

export async function customerLogin(_prev: unknown, formData: FormData) {
  const rl = rateLimit(await clientKey('customer-login'), AUTH_LIMIT);
  if (!rl.ok) return tooMany();

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  // B7.7: shared open-redirect guard (also blocks backslash tricks).
  const { safeNext } = await import('@/lib/redirect');
  const next = safeNext(String(formData.get('next') || '')) ?? '/customer';

  if (!isValidEmail(email) || !password) {
    return { error: 'Please enter your email and password.' };
  }
  // Per-email bucket alongside the per-IP one (credential-stuffing defense).
  const rlEmail = rateLimit(`customer-login-email:${email}`, AUTH_LIMIT);
  if (!rlEmail.ok) return tooMany();
  // Same cap as signup: keeps the PBKDF2 verify cheap even
  // when the stored account was created before the cap existed.
  if (isPasswordTooLong(password)) {
    return { error: 'Please enter your email and password.' };
  }

  const customer = await prisma.customerUser.findUnique({ where: { email } }).catch(() => null);
  // S6: always verify, even for a non-existent email — verifying against the
  // dummy hash costs one full PBKDF2, so the response time no longer reveals
  // whether the email is registered.
  const ok = await verifyCustomerPassword(
    password,
    customer?.passwordHash ?? DUMMY_CUSTOMER_HASH,
  );
  if (!customer || !ok) {
    return { error: 'Invalid email or password.' };
  }

  await createCustomerSession(customer.id);
  redirect(next);
}

export async function customerLogout() {
  await destroyCustomerSession();
  redirect('/directory');
}
