'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  isAttachmentEntityType,
  validateAttachmentFile,
  buildBlobPathname,
  type AttachmentEntityType,
  type AttachmentFileError,
} from '@/lib/attachments';

/** Machine-readable error codes; the client maps each to an i18n string. */
export type AttachmentErrorCode =
  | 'rateLimited'
  | 'notConfigured'
  | 'invalidEntity'
  | 'entityNotFound'
  | 'noFile'
  | 'notAFile'
  | AttachmentFileError
  | 'uploadFailed'
  | 'notFound'
  | 'deleteFailed';

export type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type AttachmentResult = {
  ok: boolean;
  error?: AttachmentErrorCode;
  attachment?: AttachmentRow;
  attachments?: AttachmentRow[];
};

/** Env check: the Blob token must exist before any upload/delete can run. */
export async function blobConfigured(): Promise<boolean> {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function checkLimit(userId: string): Promise<AttachmentErrorCode | null> {
  const rl = rateLimit(`attachments:${userId}`, ACTION_LIMIT);
  return rl.ok ? null : 'rateLimited';
}

/**
 * Verify the referenced entity row belongs to this business.
 * Tenant isolation: every attachment target is checked before upload/list.
 */
async function entityBelongsToBusiness(
  entityType: AttachmentEntityType,
  entityId: string,
  businessId: string
): Promise<boolean> {
  const where = { id: entityId, businessId };
  const select = { id: true };
  switch (entityType) {
    case 'job':
      return !!(await prisma.job.findFirst({ where, select }));
    case 'customer':
      return !!(await prisma.customer.findFirst({ where, select }));
    case 'quote':
      return !!(await prisma.quote.findFirst({ where, select }));
    case 'invoice':
      return !!(await prisma.invoice.findFirst({ where, select }));
    case 'review':
      return !!(await prisma.review.findFirst({ where, select }));
    case 'lead':
      return !!(await prisma.lead.findFirst({ where, select }));
  }
}

/** Detail-page path for each entity type (used for revalidation). */
function entityPath(entityType: AttachmentEntityType, entityId: string): string {
  return `/${entityType}s/${entityId}`;
}

function toRow(a: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): AttachmentRow {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * Upload one file as an attachment on an entity the business owns.
 * FormData fields: entityType, entityId, file.
 */
export async function uploadAttachment(formData: FormData): Promise<AttachmentResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return { ok: false, error: limited };

  const entityTypeRaw = String(formData.get('entityType') ?? '').trim();
  const entityId = String(formData.get('entityId') ?? '').trim();
  const file = formData.get('file');

  if (!isAttachmentEntityType(entityTypeRaw) || !entityId) {
    return { ok: false, error: 'invalidEntity' };
  }
  const entityType = entityTypeRaw;

  if (!(file instanceof File)) {
    return { ok: false, error: 'noFile' };
  }

  const fileError = validateAttachmentFile({ size: file.size, type: file.type });
  if (fileError) return { ok: false, error: fileError };

  if (!(await entityBelongsToBusiness(entityType, entityId, businessId))) {
    return { ok: false, error: 'entityNotFound' };
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, error: 'notConfigured' };

  try {
    const uid = randomUUID().replace(/-/g, '').slice(0, 12);
    const pathname = buildBlobPathname({
      businessId,
      entityType,
      entityId,
      uid,
      fileName: file.name || 'file',
    });
    const blob = await put(pathname, file, { access: 'public', token });

    const row = await prisma.attachment.create({
      data: {
        businessId,
        entityType,
        entityId,
        fileName: file.name || 'file',
        mimeType: file.type,
        sizeBytes: file.size,
        blobUrl: blob.url,
        blobPathname: pathname,
        uploadedById: user.id ?? null,
      },
    });

    revalidatePath(entityPath(entityType, entityId));
    return { ok: true, attachment: toRow(row) };
  } catch (e) {
    console.error('[attachments] upload failed', e);
    return { ok: false, error: 'uploadFailed' };
  }
}

/** List attachments on an entity the business owns, newest first. */
export async function listAttachments(
  entityTypeRaw: string,
  entityId: string
): Promise<AttachmentResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return { ok: false, error: limited };

  if (!isAttachmentEntityType(entityTypeRaw) || !entityId) {
    return { ok: false, error: 'invalidEntity' };
  }
  const entityType: AttachmentEntityType = entityTypeRaw;

  if (!(await entityBelongsToBusiness(entityType, entityId, businessId))) {
    return { ok: false, error: 'entityNotFound' };
  }

  const rows = await prisma.attachment.findMany({
    where: { businessId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
  return { ok: true, attachments: rows.map(toRow) };
}

/**
 * Delete an attachment the business owns: remove the Blob object
 * (best-effort) and the DB row.
 */
export async function deleteAttachment(id: string): Promise<AttachmentResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return { ok: false, error: limited };

  const row = await prisma.attachment.findFirst({
    where: { id, businessId },
  });
  if (!row) return { ok: false, error: 'notFound' };

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    // Best-effort: the DB row is deleted even if Blob removal fails.
    if (token) {
      await del(row.blobUrl, { token }).catch((e) =>
        console.error('[attachments] blob delete failed', e)
      );
    }
    await prisma.attachment.delete({ where: { id: row.id } });
    revalidatePath(entityPath(row.entityType as AttachmentEntityType, row.entityId));
    return { ok: true };
  } catch (e) {
    console.error('[attachments] delete failed', e);
    return { ok: false, error: 'deleteFailed' };
  }
}
