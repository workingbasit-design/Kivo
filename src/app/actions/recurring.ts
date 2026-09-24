'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recurringSchema } from '@/lib/validations';
import { generateDueJobs } from '@/lib/recurring';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type RecurringActionResult = { error?: string; ok?: boolean; created?: number };

async function checkLimit(userId: string, prefix: string): Promise<RecurringActionResult | null> {
  const rl = rateLimit(`${prefix}:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

/** 'YYYY-MM-DD' -> local-midnight Date for Prisma DateTime. */
function parseDateInput(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

async function getOwnedRecurring(businessId: string, id: string) {
  return prisma.recurringJob.findFirst({ where: { id, businessId } });
}

async function getOwnedCustomer(businessId: string, customerId: string) {
  return prisma.customer.findFirst({ where: { id: customerId, businessId } });
}

function revalidateRecurringPaths() {
  revalidatePath('/recurring');
  revalidatePath('/jobs');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
}

/** Create a new recurring job plan. */
export async function createRecurring(
  _prev: RecurringActionResult,
  formData: FormData
): Promise<RecurringActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'createRecurring');
  if (limited) return limited;

  const parsed = recurringSchema.safeParse({
    title: formData.get('title'),
    customerId: formData.get('customerId'),
    frequency: formData.get('frequency'),
    startDate: formData.get('startDate'),
    time: formData.get('time') ?? '',
    address: formData.get('address') ?? '',
    price: formData.get('price'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid recurring job details.' };
  }

  const customer = await getOwnedCustomer(businessId, parsed.data.customerId);
  if (!customer) return { error: 'Selected customer not found.' };

  await prisma.recurringJob.create({
    data: {
      title: parsed.data.title,
      frequency: parsed.data.frequency,
      nextRun: parseDateInput(parsed.data.startDate),
      time: parsed.data.time || null,
      address: parsed.data.address || null,
      price: Math.round(parsed.data.price * 100) / 100, // cents (2026-09-24)
      notes: parsed.data.notes || null,
      customerId: parsed.data.customerId,
      businessId,
    },
  });

  revalidateRecurringPaths();
  redirect('/recurring');
}

/** Update an existing recurring job plan (ownership verified). */
export async function updateRecurring(
  _prev: RecurringActionResult,
  formData: FormData
): Promise<RecurringActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'updateRecurring');
  if (limited) return limited;

  const id = String(formData.get('id') ?? '');
  const existing = await getOwnedRecurring(businessId, id);
  if (!existing) return { error: 'Recurring job not found.' };

  const parsed = recurringSchema.safeParse({
    title: formData.get('title'),
    customerId: formData.get('customerId'),
    frequency: formData.get('frequency'),
    startDate: formData.get('startDate'),
    time: formData.get('time') ?? '',
    address: formData.get('address') ?? '',
    price: formData.get('price'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid recurring job details.' };
  }

  const customer = await getOwnedCustomer(businessId, parsed.data.customerId);
  if (!customer) return { error: 'Selected customer not found.' };

  await prisma.recurringJob.update({
    where: { id },
    data: {
      title: parsed.data.title,
      frequency: parsed.data.frequency,
      nextRun: parseDateInput(parsed.data.startDate),
      time: parsed.data.time || null,
      address: parsed.data.address || null,
      price: Math.round(parsed.data.price * 100) / 100, // cents (2026-09-24)
      notes: parsed.data.notes || null,
      customerId: parsed.data.customerId,
    },
  });

  revalidateRecurringPaths();
  redirect('/recurring');
}

/** Pause or resume a recurring job plan. */
export async function toggleRecurringActive(id: string): Promise<RecurringActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'toggleRecurringActive');
  if (limited) return limited;

  const existing = await getOwnedRecurring(businessId, id);
  if (!existing) return { error: 'Recurring job not found.' };

  await prisma.recurringJob.update({
    where: { id },
    data: { active: !existing.active },
  });

  revalidateRecurringPaths();
  return { ok: true };
}

/**
 * Delete a recurring job plan. Jobs already generated from it are kept —
 * the relation is SetNull in the schema.
 */
export async function deleteRecurring(id: string): Promise<RecurringActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'deleteRecurring');
  if (limited) return limited;

  const existing = await getOwnedRecurring(businessId, id);
  if (!existing) return { error: 'Recurring job not found.' };

  await prisma.recurringJob.delete({ where: { id } });

  revalidateRecurringPaths();
  return { ok: true };
}

/**
 * User-triggered generation of due recurring jobs (manual catch-up button).
 * The dashboard also runs generation lazily on every load, so this is now
 * just a manual "catch up further" control. Uses the same transactional,
 * idempotent generateDueJobs().
 */
export async function runRecurringGeneration(): Promise<RecurringActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'runRecurringGeneration');
  if (limited) return limited;

  const { created } = await generateDueJobs(businessId);

  revalidateRecurringPaths();
  return { ok: true, created };
}
