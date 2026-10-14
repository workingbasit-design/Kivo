/**
 * AuditEvent append-only + secrets scrubbing tests (M5).
 *
 * Needs a real Postgres with the M5 migration applied. Skips unless
 * TEST_DATABASE_URL is set (CI runs this against the CI Postgres
 * service). Never runs against production - the URL is supplied by the
 * caller and must point at a scratch database.
 *
 * NOTE: the append-only trigger also blocks FK-cascade deletes, so test
 * cleanup disables the trigger first (the documented purge pattern for
 * the admin-only business purge), then re-enables it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { writeAuditEvent, scrubObject } from '../audit.ts';

const TEST_URL = process.env.TEST_DATABASE_URL;

describe('AuditEvent append-only and scrubbing (M5)', () => {
  if (!TEST_URL) {
    it('skipped - TEST_DATABASE_URL not set', () => {});
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  const FAKE_TOKEN = 'sk_test_fake123';

  async function withBiz<T>(fn: (bizId: string) => Promise<T>): Promise<T> {
    const biz = await prisma.business.create({
      data: { name: 'audit-test-biz', timezone: 'America/Toronto' },
    });
    try {
      return await fn(biz.id);
    } finally {
      // Purge pattern: disable the append-only trigger, delete (cascades),
      // re-enable. This mirrors the documented admin purge procedure.
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_events_no_update_delete'
      );
      try {
        await prisma.business.delete({ where: { id: biz.id } });
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_events_no_update_delete'
        );
      }
    }
  }

  it('UPDATE on an AuditEvent row fails', async () => {
    await withBiz(async (bizId) => {
      const ev = await prisma.auditEvent.create({
        data: {
          businessId: bizId,
          actorId: 'system',
          actorType: 'SYSTEM',
          action: 'SETTINGS_CHANGE',
          entityType: 'Business',
          entityId: bizId,
        },
      });
      await assert.rejects(
        prisma.auditEvent.update({ where: { id: ev.id }, data: { action: 'LOGIN' } }),
        /append-only/
      );
    });
  });

  it('DELETE on an AuditEvent row fails', async () => {
    await withBiz(async (bizId) => {
      const ev = await prisma.auditEvent.create({
        data: {
          businessId: bizId,
          actorId: 'system',
          actorType: 'SYSTEM',
          action: 'SETTINGS_CHANGE',
          entityType: 'Business',
          entityId: bizId,
        },
      });
      await assert.rejects(
        prisma.auditEvent.delete({ where: { id: ev.id } }),
        /append-only/
      );
    });
  });

  it('CHECK rejects unknown actions and actor types', async () => {
    await withBiz(async (bizId) => {
      await assert.rejects(
        prisma.auditEvent.create({
          data: {
            businessId: bizId,
            actorId: 'system',
            actorType: 'SYSTEM',
            action: 'HACK_THE_PLANET',
            entityType: 'Business',
          },
        }),
        /check/i
      );
      await assert.rejects(
        prisma.auditEvent.create({
          data: {
            businessId: bizId,
            actorId: 'system',
            actorType: 'ALIEN',
            action: 'LOGIN',
            entityType: 'Business',
          },
        }),
        /check/i
      );
    });
  });

  it('writeAuditEvent scrubs secrets from stored JSON', async () => {
    await withBiz(async (bizId) => {
      await writeAuditEvent(prisma, {
        businessId: bizId,
        actorId: 'user_1',
        actorType: 'USER',
        action: 'SETTINGS_CHANGE',
        entityType: 'Business',
        entityId: bizId,
        after: {
          stripeSecretKey: FAKE_TOKEN,
          passwordHash: '$2b$10$abcdef',
          apiKey: 'key_live_123',
          normalField: 'visible',
          nested: { bearer: FAKE_TOKEN },
        },
      });
      const stored = await prisma.auditEvent.findFirst({
        where: { businessId: bizId, action: 'SETTINGS_CHANGE' },
      });
      assert.ok(stored?.afterJson, 'expected afterJson');
      assert.ok(!stored.afterJson.includes(FAKE_TOKEN), 'fake token leaked into audit JSON');
      assert.ok(!stored.afterJson.includes('$2b$10$abcdef'), 'password hash leaked');
      assert.ok(stored.afterJson.includes('[REDACTED]'), 'expected [REDACTED] markers');
      assert.ok(stored.afterJson.includes('visible'), 'non-secret field must survive');
    });
  });

  it('scrubObject redacts bearer-like values even under innocent keys', () => {
    const out = scrubObject({
      note: 'reset link',
      token: 'plain-value',
      ref: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummy-signature-value',
    });
    assert.equal(out.token, '[REDACTED]');
    assert.equal(out.note, 'reset link');
    assert.equal(out.ref, '[REDACTED]');
  });
});
