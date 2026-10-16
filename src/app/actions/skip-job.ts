'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

type Result = { error?: string; success?: boolean };

/**
 * F3: Skip a recurring visit (or unscheduled job).
 * The job stays visible with a "Skipped" badge, but is excluded from
 * the schedule and "Ready to invoice".
 */
export async function skipJob(jobId: string): Promise<Result> {
  const session = await requireAuth();
  const businessId = session.businessId;
  if (!businessId) return { error: 'No business.' };

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, skippedAt: true },
  });
  if (!job) return { error: 'Job not found.' };
  if (job.skippedAt) return { error: 'Already skipped.' };

  await prisma.job.update({
    where: { id: jobId },
    data: { skippedAt: new Date() },
  });

  revalidatePath('/jobs');
  revalidatePath('/schedule');
  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

/**
 * F3: Unskip a visit (restore it to the schedule).
 */
export async function unskipJob(jobId: string): Promise<Result> {
  const session = await requireAuth();
  const businessId = session.businessId;
  if (!businessId) return { error: 'No business.' };

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, skippedAt: true },
  });
  if (!job) return { error: 'Job not found.' };
  if (!job.skippedAt) return { error: 'Not skipped.' };

  await prisma.job.update({
    where: { id: jobId },
    data: { skippedAt: null },
  });

  revalidatePath('/jobs');
  revalidatePath('/schedule');
  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}
