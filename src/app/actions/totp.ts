'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth, createSession } from '@/lib/auth';
import { rateLimit, AUTH_LIMIT } from '@/lib/rate-limit';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import {
  generateTotpSecret,
  verifyTotp,
  totpOtpAuthUrl,
  generateBackupCodes,
  consumeBackupCode,
  signTotpChallenge,
  verifyTotpChallenge,
} from '@/lib/totp';

export type TotpResult = {
  error?: string;
  ok?: boolean;
  /** beginTotpSetup: manual-entry secret + otpauth URL (no QR lib - no new deps). */
  secret?: string;
  otpauthUrl?: string;
  /** confirmTotpSetup: backup codes, shown ONCE. */
  backupCodes?: string[];
  /** login step 2. */
  challenge?: string;
  totpRequired?: boolean;
};

async function authedUserId() {
  const session = await requireAuth();
  return session.user.id;
}

/**
 * Step 1 of enrollment: generate a secret, store it ENCRYPTED, but leave
 * totpEnabled=false until the user proves they can produce a valid code.
 */
export async function beginTotpSetup(): Promise<TotpResult> {
  const userId = await authedUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });
  if (!user) return { error: 'Not signed in.' };
  if (user.totpEnabled) return { error: 'Two-factor authentication is already on.' };
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secret) },
  });
  return { ok: true, secret, otpauthUrl: totpOtpAuthUrl(secret, user.email) };
}

/**
 * Step 2 of enrollment: verify a code from the authenticator app, then
 * enable TOTP and issue single-use backup codes (returned once).
 */
export async function confirmTotpSetup(code: string): Promise<TotpResult> {
  const userId = await authedUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpSecret) return { error: 'Start setup first.' };
  if (user.totpEnabled) return { error: 'Two-factor authentication is already on.' };
  const secret = decryptSecret(user.totpSecret);
  if (!secret || !verifyTotp(secret, code)) {
    return { error: 'That code did not work. Check your authenticator app and try again.' };
  }
  const { codes, hashes } = generateBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true, totpBackupCodes: JSON.stringify(hashes) },
  });
  return { ok: true, backupCodes: codes };
}

/** Disable TOTP. Requires the account password (a stolen session is not enough). */
export async function disableTotp(password: string): Promise<TotpResult> {
  const userId = await authedUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, totpEnabled: true },
  });
  if (!user) return { error: 'Not signed in.' };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: 'Incorrect password.' };
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false, totpBackupCodes: null },
  });
  return { ok: true };
}

/**
 * Login step 2: the password step already succeeded and issued a signed
 * challenge. Accepts a TOTP code OR a single-use backup code.
 */
export async function verifyTotpLogin(challenge: string, code: string): Promise<TotpResult> {
  const rl = rateLimit(`totp:${challenge.slice(0, 24)}`, AUTH_LIMIT);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a moment.' };
  const userId = verifyTotpChallenge(challenge);
  if (!userId) return { error: 'This verification expired. Please sign in again.' };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, totpSecret: true, totpEnabled: true, totpBackupCodes: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) {
    return { error: 'Two-factor authentication is not enabled.' };
  }
  const secret = decryptSecret(user.totpSecret);
  if (secret && verifyTotp(secret, code)) {
    await createSession(user.id);
    redirect('/dashboard');
  }
  // Fall back to single-use backup codes.
  const hashes: string[] = user.totpBackupCodes ? JSON.parse(user.totpBackupCodes) : [];
  const remaining = consumeBackupCode(hashes, code);
  if (remaining) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpBackupCodes: JSON.stringify(remaining) },
    });
    await createSession(user.id);
    redirect('/dashboard');
  }
  // Same generic message whether the code was wrong or a backup code was
  // already used: no oracle for which factor failed.
  return { error: 'That code did not work. Try again.' };
}

export { signTotpChallenge };
