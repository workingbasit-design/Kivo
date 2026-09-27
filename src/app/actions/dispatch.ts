'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const VALID_STATUSES = ['SCHEDULED', 'IN PROGRESS', 'COMPLETED'] as const;

/**
 * Dispatch board actions — advance a job's status or assign a technician.
 * Tenant-scoped: the job must belong to the caller's business.
 */
export async function updateJobStatus(jobId: string, status: string): Promise<ActionResult> {
  const { businessId } = await requireAuth();
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'Invalid status' };
  }
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true },
  });
  if (!job) return { ok: false, error: 'Job not found' };

  await prisma.job.update({
    where: { id: jobId },
    data: { status },
  });
  revalidatePath('/dispatch');
  revalidatePath('/schedule');
  return { ok: true };
}

export async function assignJobTechnician(jobId: string, userId: string): Promise<ActionResult> {
  const { businessId } = await requireAuth();

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true },
  });
  if (!job) return { ok: false, error: 'Job not found' };

  if (!userId) {
    await prisma.job.update({
      where: { id: jobId },
      data: { assignedToId: null },
    });
  } else {
    // The technician must belong to the same business.
    const member = await prisma.user.findFirst({
      where: { id: userId, businessId },
      select: { id: true, name: true },
    });
    if (!member) return { ok: false, error: 'Team member not found' };
    await prisma.job.update({
      where: { id: jobId },
      data: { assignedToId: userId, technician: member.name },
    });
  }
  revalidatePath('/dispatch');
  return { ok: true };
}
