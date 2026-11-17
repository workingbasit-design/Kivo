'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimitDurable, AUTH_LIMIT } from '@/lib/rate-limit-durable';
import {
  newResetToken,
  hashResetToken,
  isResetTokenUsable,
  RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';
import { hashCustomerPassword } from '@/lib/customer-auth';
import { isPasswordTooLong, MAX_PASSWORD_LENGTH } from '@/lib/password-policy';
import { sendPlatformEmail } from '@/lib/messaging/platform-email';
import { passwordResetEmail } from '@/lib/messaging/email-templates';
import { appBaseUrl } from '@/lib/app-url';
import { clientIpFromHeaders } from '@/lib/client-ip';

export type CustomerResetResult = { error?: string; ok?: boolean };

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email.'),
});

const confirmSchema = z.object({
  token: z.string().trim().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(MAX_PASSWORD_LENGTH),
});

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  return `${prefix}:${ip}`;
}

function tooMany(ret: { retryAfterMs: number }): CustomerResetResult {
  const secs = Math.max(1, Math.ceil(ret.retryAfterMs / 1000));
  return {
    error: `Too many attempts. Please try again in ${secs} second${secs === 1 ? '' : 's'}.`,
  };
}

/**
 * Request a customer password-reset link. ALWAYS returns { ok: true } for a
 * valid email shape - even when no account exists - so the endpoint can
 * never be used to enumerate registered emails. Mirrors the business reset
 * (src/app/actions/password-reset.ts); the token table is
 * CustomerPasswordResetToken (P1.0 B-6 - customers had no reset flow at all).
 */
export async function requestCustomerPasswordReset(
  _prev: CustomerResetResult,
  formData: FormData,
): Promise<CustomerResetResult> {
  const rl = await rateLimitDurable(await clientKey('customer-pw-reset'), AUTH_LIMIT);
  if (!rl.ok) return tooMany(rl);

  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email.' };
  }
  const { email } = parsed.data;

  // Per-email bucket alongside the per-IP one: without it, an attacker
  // could flood one victim's inbox with reset emails by rotating IPs.
  const rlEmail = await rateLimitDurable(`customer-pw-reset-email:${email}`, AUTH_LIMIT);
  if (!rlEmail.ok) return tooMany(rlEmail);

  const customer = await prisma.customerUser.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (customer) {
    const token = newResetToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await prisma.$transaction([
      // One live token per customer: retire any older unused ones.
      prisma.customerPasswordResetToken.deleteMany({
        where: { customerId: customer.id, usedAt: null },
      }),
      prisma.customerPasswordResetToken.create({
        data: { customerId: customer.id, tokenHash, expiresAt },
      }),
    ]);

    const base = await appBaseUrl();
    if (base) {
      const link = `${base}/customer/reset-password/${token}`;
      const firstName = (customer.name ?? '').trim().split(/\s+/)[0] || 'there';
      // Best-effort: a missing RESEND_API_KEY only skips the email (logged
      // server-side); the request itself still "succeeds" - no enumeration.
      const tpl = passwordResetEmail(firstName, link);
      await sendPlatformEmail(customer.email, tpl.subject, tpl.text, {
        fromName: 'EveryJob',
        htmlBody: tpl.html,
      });
    }
  }

  return { ok: true };
}

/**
 * Set a new customer password from a reset token. Single-use: marks the
 * token used and invalidates ALL existing customer sessions (a compromised
 * old password must not leave live sessions behind).
 */
export async function resetCustomerPassword(
  _prev: CustomerResetResult,
  formData: FormData,
): Promise<CustomerResetResult> {
  const rl = await rateLimitDurable(await clientKey('customer-pw-reset-confirm'), AUTH_LIMIT);
  if (!rl.ok) return tooMany(rl);

  const parsed = confirmSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'This reset link is invalid. Please request a new one.' };
  }
  if (isPasswordTooLong(parsed.data.password)) {
    return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }

  const row = await prisma.customerPasswordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });
  if (!row || !isResetTokenUsable(row)) {
    return {
      error: 'This reset link is invalid or has expired. Please request a new one.',
    };
  }

  // B7.3a: reject breached passwords (fail-open on HIBP outage).
  const { isPasswordBreached } = await import('@/lib/breached-passwords');
  const breach = await isPasswordBreached(parsed.data.password);
  if (breach.breached) {
    return { error: 'This password has appeared in a data breach. Please choose a different one.' };
  }

  const passwordHash = await hashCustomerPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.customerUser.update({
      where: { id: row.customerId },
      data: { passwordHash },
    }),
    prisma.customerPasswordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate every session: the password change must log the customer
    // out everywhere, including any attacker-held session.
    prisma.customerSession.deleteMany({ where: { customerId: row.customerId } }),
  ]);

  return { ok: true };
}
