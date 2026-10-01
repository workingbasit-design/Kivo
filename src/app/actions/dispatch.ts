'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { JOB_STATUSES } from '@/lib/validations';
import { isValidTransition } from '@/lib/job-status';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function checkLimit(userId: string): Promise<ActionResult | null> {
  const rl = rateLimit(`dispatch:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { ok: false, error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

/**
 * Dispatch board actions — advance a job's status or assign a technician.
 * Tenant-scoped: the job must belong to the caller's business.
 * Status changes follow the same pipeline transition rules as the job
 * detail page (forward freely, one step back for mistaken taps).
 */
export async function updateJobStatus(jobId: string, status: string): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  if (!(JOB_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'Invalid status' };
  }
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, status: true },
  });
  if (!job) return { ok: false, error: 'Job not found' };
  if (!isValidTransition(job.status, status)) {
    return { ok: false, error: `Cannot move job from ${job.status} to ${status}.` };
  }

  await prisma.job.update({
    where: { id: jobId, businessId },
    data: { status },
  });
  revalidatePath('/dispatch');
  revalidatePath('/schedule');
  return { ok: true };
}

export async function assignJobTechnician(jobId: string, technicianUserId: string): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true },
  });
  if (!job) return { ok: false, error: 'Job not found' };

  if (!technicianUserId) {
    await prisma.job.update({
      where: { id: jobId, businessId },
      data: { assignedToId: null },
    });
  } else {
    // The technician must belong to the same business.
    const member = await prisma.user.findFirst({
      where: { id: technicianUserId, businessId },
      select: { id: true, name: true },
    });
    if (!member) return { ok: false, error: 'Team member not found' };
    await prisma.job.update({
      where: { id: jobId, businessId },
      data: { assignedToId: technicianUserId, technician: member.name },
    });
  }
  revalidatePath('/dispatch');
  return { ok: true };
}
