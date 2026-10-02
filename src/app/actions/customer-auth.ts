'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  createCustomerSession,
  destroyCustomerSession,
  hashCustomerPassword,
  verifyCustomerPassword,
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

  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const phone = String(formData.get('phone') || '').trim();
  const city = String(formData.get('city') || '').trim();

  if (!name) return { error: 'Please enter your name.' };
  if (!isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  // Cap password length: hashing runs PBKDF2-SHA512 100k iterations
  // synchronously, so an unbounded input on this unauthenticated endpoint
  // would burn CPU and block the event loop.
  if (isPasswordTooLong(password)) return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };

  const existing = await prisma.customerUser.findUnique({ where: { email } }).catch(() => null);
  if (existing) return { error: 'An account with this email already exists. Please log in.' };

  const customer = await prisma.customerUser.create({
    data: {
      name,
      email,
      passwordHash: hashCustomerPassword(password),
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
  const rawNext = String(formData.get('next') || '').trim();
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/customer';

  if (!isValidEmail(email) || !password) {
    return { error: 'Please enter your email and password.' };
  }
  // Per-email bucket alongside the per-IP one (credential-stuffing defense).
  const rlEmail = rateLimit(`customer-login-email:${email}`, AUTH_LIMIT);
  if (!rlEmail.ok) return tooMany();
  // Same cap as signup: keeps the sync PBKDF2 verify cheap even
  // when the stored account was created before the cap existed.
  if (isPasswordTooLong(password)) {
    return { error: 'Please enter your email and password.' };
  }

  const customer = await prisma.customerUser.findUnique({ where: { email } }).catch(() => null);
  if (!customer || !verifyCustomerPassword(password, customer.passwordHash)) {
    return { error: 'Invalid email or password.' };
  }

  await createCustomerSession(customer.id);
  redirect(next);
}

export async function customerLogout() {
  await destroyCustomerSession();
  redirect('/directory');
}
