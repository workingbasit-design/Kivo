'use server';

import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';
import {
  newResetToken,
  hashResetToken,
  isResetTokenUsable,
  RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';
import { sendPlatformEmail } from '@/lib/messaging/platform-email';
import { appBaseUrl } from '@/lib/app-url';
import { clientIpFromHeaders } from '@/lib/client-ip';

export type ResetResult = { error?: string; ok?: boolean };

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email.'),
});

const confirmSchema = z.object({
  token: z.string().trim().min(1).max(128),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
});

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  return `${prefix}:${ip}`;
}

function tooMany(ret: { retryAfterMs: number }): ResetResult {
  const secs = Math.max(1, Math.ceil(ret.retryAfterMs / 1000));
  return {
    error: `Too many attempts. Please try again in ${secs} second${secs === 1 ? '' : 's'}.`,
  };
}

/**
 * Request a password-reset link. ALWAYS returns { ok: true } for a valid
 * email shape — even when no account exists — so the endpoint can never be
 * used to enumerate registered emails.
 */
export async function requestPasswordReset(
  _prev: ResetResult,
  formData: FormData
): Promise<ResetResult> {
  const rl = rateLimit(await clientKey('pw-reset'), AUTH_LIMIT);
  if (!rl.ok) return tooMany(rl);

  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email.' };
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  // Password resets only make sense for password accounts. Google-only
  // accounts (no passwordHash) get the same silent success — no enumeration.
  if (user?.passwordHash) {
    const token = newResetToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await prisma.$transaction([
      // One live token per user: retire any older unused ones.
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const base = await appBaseUrl();
    if (base) {
      const link = `${base}/reset-password/${token}`;
      const firstName = (user.name ?? '').trim().split(/\s+/)[0] || 'there';
      // Best-effort: a missing RESEND_API_KEY only skips the email (logged
      // server-side); the request itself still "succeeds" — no enumeration.
      await sendPlatformEmail(
        user.email,
        'Reset your EveryJob password / Réinitialisez votre mot de passe EveryJob',
        [
          `Hi ${firstName},`,
          '',
          'Someone requested a password reset for your EveryJob account.',
          `Reset it here (valid for 1 hour, one-time use): ${link}`,
          'If that wasn’t you, just ignore this email — your password is unchanged.',
          '',
          '— The EveryJob team',
          '',
          '---',
          '',
          `Bonjour ${firstName},`,
          '',
          'Une réinitialisation de mot de passe a été demandée pour votre compte EveryJob.',
          `Réinitialisez-le ici (valide 1 heure, usage unique) : ${link}`,
          'Si ce n’était pas vous, ignorez simplement ce courriel — votre mot de passe est inchangé.',
          '',
          '— L’équipe EveryJob',
        ].join('\n')
      );
    }
  }

  return { ok: true };
}

/**
 * Set a new password from a reset token. Single-use: marks the token used
 * and invalidates ALL existing sessions for the user (a compromised old
 * password must not leave live sessions behind).
 */
export async function resetPassword(
  _prev: ResetResult,
  formData: FormData
): Promise<ResetResult> {
  const rl = rateLimit(await clientKey('pw-reset-confirm'), AUTH_LIMIT);
  if (!rl.ok) return tooMany(rl);

  const parsed = confirmSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'This reset link is invalid. Please request a new one.' };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });
  if (!row || !isResetTokenUsable(row)) {
    return {
      error: 'This reset link is invalid or has expired. Please request a new one.',
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate every session: the password change must log the user out
    // everywhere, including any attacker-held session.
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { ok: true };
}
