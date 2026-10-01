'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  createCustomerSession,
  destroyCustomerSession,
  hashCustomerPassword,
  verifyCustomerPassword,
} from '@/lib/customer-auth';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function customerSignup(_prev: unknown, formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const phone = String(formData.get('phone') || '').trim();
  const city = String(formData.get('city') || '').trim();

  if (!name) return { error: 'Please enter your name.' };
  if (!isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

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
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const rawNext = String(formData.get('next') || '').trim();
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/customer';

  if (!isValidEmail(email) || !password) {
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
