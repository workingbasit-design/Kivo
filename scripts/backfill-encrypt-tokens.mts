/**
 * Backfill: encrypt plaintext OAuth tokens at rest (Prompt 3, B4.2).
 *
 * Reads every GoogleConnection + QuickBooksConnection row, encrypts any
 * accessToken/refreshToken that is not already encrypted (AES-256-GCM via
 * src/lib/crypto.ts), and writes the ciphertext back in place.
 * Idempotent: already-encrypted values are skipped.
 *
 * SAFETY (hard rules):
 *  - LOCAL AND STAGING ONLY. Never run against production.
 *  - Refuses to run when the database URL looks like production
 *    (contains "prod") unless ALLOW_TOKEN_BACKFILL=1 is set explicitly.
 *  - Production backfill requires the user's explicit, separate approval.
 *
 * Usage:
 *   ALLOW_TOKEN_BACKFILL=1 DATABASE_URL="postgresql://..." \
 *     npx tsx scripts/backfill-encrypt-tokens.mts
 */
import { PrismaClient } from '@prisma/client';
import { encryptSecret, isEncrypted } from '../src/lib/crypto.ts';

const url = process.env.DATABASE_URL ?? '';
if (!process.env.ALLOW_TOKEN_BACKFILL) {
  console.error('Refusing: set ALLOW_TOKEN_BACKFILL=1 to run this backfill.');
  process.exit(1);
}
if (/prod/i.test(url)) {
  console.error('Refusing: DATABASE_URL looks like production. This backfill is local/staging only.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  let encrypted = 0;
  let skipped = 0;

  const googleRows = await prisma.googleConnection.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });
  for (const row of googleRows) {
    const patch: { accessToken?: string; refreshToken?: string | null } = {};
    if (row.accessToken && !isEncrypted(row.accessToken)) {
      patch.accessToken = encryptSecret(row.accessToken);
    }
    if (row.refreshToken && !isEncrypted(row.refreshToken)) {
      patch.refreshToken = encryptSecret(row.refreshToken);
    }
    if (Object.keys(patch).length) {
      await prisma.googleConnection.update({ where: { id: row.id }, data: patch });
      encrypted++;
    } else {
      skipped++;
    }
  }

  const qbRows = await prisma.quickBooksConnection.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });
  for (const row of qbRows) {
    const patch: { accessToken?: string; refreshToken?: string } = {};
    if (row.accessToken && !isEncrypted(row.accessToken)) {
      patch.accessToken = encryptSecret(row.accessToken);
    }
    if (row.refreshToken && !isEncrypted(row.refreshToken)) {
      patch.refreshToken = encryptSecret(row.refreshToken);
    }
    if (Object.keys(patch).length) {
      await prisma.quickBooksConnection.update({ where: { id: row.id }, data: patch });
      encrypted++;
    } else {
      skipped++;
    }
  }

  console.log(`backfill-encrypt-tokens: encrypted=${encrypted} already-encrypted=${skipped}`);
}

main()
  .catch((err) => {
    console.error('backfill-encrypt-tokens FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
