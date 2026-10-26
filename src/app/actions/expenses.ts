'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { dollarsToCents } from '@/lib/money';
import {
  validateExpenseForm,
  buildExpenseReceiptPathname,
  isReceiptMime,
} from '@/lib/expenses';

export type ExpenseResult =
  | { ok: true }
  | { ok: false; error: string; errorKey?: string };

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function checkLimit(userId: string): Promise<ExpenseResult | null> {
  const rl = rateLimit(`expenses:${userId}`, ACTION_LIMIT);
  if (!rl.ok) return { ok: false, error: 'rateLimited' };
  return null;
}

function revalidateExpenses() {
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

/** Upload a receipt photo to Blob; returns the public URL or an error code. */
async function uploadReceipt(
  businessId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  if (!isReceiptMime(file.type)) return { error: 'receiptBadType' };
  if (file.size > RECEIPT_MAX_BYTES) return { error: 'receiptTooLarge' };
  // B12: magic-byte validation (never trust the client MIME) + GPS rejection.
  const { validateUploadBytes } = await import('@/lib/upload-validate');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateUploadBytes(bytes, file.type).ok) return { error: 'receiptBadContent' };
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { error: 'notConfigured' };
  try {
    const uid = randomUUID().replace(/-/g, '').slice(0, 12);
    const pathname = buildExpenseReceiptPathname({
      businessId,
      uid,
      fileName: file.name || 'receipt',
    });
    // B12: private blobs - served only through tenant-scoped routes.
    const blob = await put(pathname, file, { access: 'private', token });
    return { url: blob.url };
  } catch (e) {
    console.error('[expenses] receipt upload failed', e);
    return { error: 'uploadFailed' };
  }
}

/**
 * Create a standalone business expense (optionally tied to a job).
 * Form fields: description, amount, category, spentAt (YYYY-MM-DD),
 * jobId (optional), note (optional), receipt (File, optional).
 */
export async function createExpense(fd: FormData): Promise<ExpenseResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const parsed = validateExpenseForm({
    description: fd.get('description'),
    amount: fd.get('amount'),
    category: fd.get('category'),
    spentAt: fd.get('spentAt'),
    jobId: fd.get('jobId'),
    note: fd.get('note'),
  });
  if (!parsed.ok) return { ok: false, error: 'validation', errorKey: parsed.error };

  // Optional job link must belong to this business.
  if (parsed.data.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: parsed.data.jobId, businessId },
      select: { id: true },
    });
    if (!job) return { ok: false, error: 'jobNotFound' };
  }

  // Optional receipt photo.
  let receiptUrl: string | null = null;
  const receipt = fd.get('receipt');
  if (receipt instanceof File && receipt.size > 0) {
    const up = await uploadReceipt(businessId, receipt);
    if (up.error) return { ok: false, error: up.error };
    receiptUrl = up.url ?? null;
  }

  await prisma.jobExpense.create({
    data: {
      businessId,
      jobId: parsed.data.jobId,
      description: parsed.data.description,
      amountCents: dollarsToCents(parsed.data.amount) ?? BigInt(0),
      category: parsed.data.category,
      spentAt: new Date(parsed.data.spentAt + 'T00:00:00'),
      note: parsed.data.note,
      receiptUrl,
    },
  });
  revalidateExpenses();
  if (parsed.data.jobId) revalidatePath(`/jobs/${parsed.data.jobId}`);
  return { ok: true };
}

/**
 * Update a standalone expense. Same fields as create; passing
 * removeReceipt=1 clears the receipt photo (Blob object deleted best-effort).
 */
export async function updateExpense(
  id: string,
  fd: FormData
): Promise<ExpenseResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const existing = await prisma.jobExpense.findFirst({
    where: { id, businessId },
    select: { id: true, receiptUrl: true, jobId: true },
  });
  if (!existing) return { ok: false, error: 'notFound' };

  const parsed = validateExpenseForm({
    description: fd.get('description'),
    amount: fd.get('amount'),
    category: fd.get('category'),
    spentAt: fd.get('spentAt'),
    jobId: fd.get('jobId'),
    note: fd.get('note'),
  });
  if (!parsed.ok) return { ok: false, error: 'validation', errorKey: parsed.error };

  if (parsed.data.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: parsed.data.jobId, businessId },
      select: { id: true },
    });
    if (!job) return { ok: false, error: 'jobNotFound' };
  }

  let receiptUrl = existing.receiptUrl;
  const removeReceipt = String(fd.get('removeReceipt') ?? '') === '1';
  const receipt = fd.get('receipt');
  if (receipt instanceof File && receipt.size > 0) {
    const up = await uploadReceipt(businessId, receipt);
    if (up.error) return { ok: false, error: up.error };
    // Best-effort cleanup of the replaced photo.
    if (receiptUrl) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) await del(receiptUrl, { token }).catch(() => {});
    }
    receiptUrl = up.url ?? null;
  } else if (removeReceipt && receiptUrl) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) await del(receiptUrl, { token }).catch(() => {});
    receiptUrl = null;
  }

  const updated = await prisma.jobExpense.updateMany({
    where: { id: existing.id, businessId },
    data: {
      jobId: parsed.data.jobId,
      description: parsed.data.description,
      amountCents: dollarsToCents(parsed.data.amount) ?? BigInt(0),
      category: parsed.data.category,
      spentAt: new Date(parsed.data.spentAt + 'T00:00:00'),
      note: parsed.data.note,
      receiptUrl,
    },
  });
  if (updated.count !== 1) return { ok: false, error: 'notFound' };
  revalidateExpenses();
  revalidatePath(`/expenses/${existing.id}`);
  if (parsed.data.jobId) revalidatePath(`/jobs/${parsed.data.jobId}`);
  if (existing.jobId) revalidatePath(`/jobs/${existing.jobId}`);
  return { ok: true };
}

/** Delete a standalone expense (tenant-scoped). Receipt Blob deleted best-effort. */
export async function deleteExpense(id: string): Promise<ExpenseResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  try {
    const existing = await prisma.jobExpense.findFirst({
      where: { id, businessId },
      select: { id: true, receiptUrl: true, jobId: true },
    });
    if (!existing) return { ok: false, error: 'notFound' };

    if (existing.receiptUrl) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) await del(existing.receiptUrl, { token }).catch(() => {});
    }

    const deleted = await prisma.jobExpense.deleteMany({
      where: { id: existing.id, businessId },
    });
    if (deleted.count !== 1) return { ok: false, error: 'notFound' };
    revalidateExpenses();
    if (existing.jobId) revalidatePath(`/jobs/${existing.jobId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'deleteFailed' };
  }
}
