'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type TimesheetResult = { error?: string; ok?: boolean };

async function checkLimit(userId: string, prefix: string): Promise<TimesheetResult | null> {
  const rl = rateLimit(`${prefix}:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

function revalidateTimesheetPaths() {
  revalidatePath('/timesheets');
  revalidatePath('/dashboard');
  revalidatePath('/reports/team');
}

function isAdmin(role: string) {
  return role === 'ADMIN';
}

const clockInSchema = z.object({
  jobId: z.string().min(1).optional(),
});

/**
 * Clock in the current user. Only one active session per user.
 * Optionally attaches the session to a job.
 */
export async function clockIn(input: { jobId?: string }): Promise<TimesheetResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'clockIn');
  if (limited) return limited;

  const parsed = clockInSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Invalid clock-in details.' };
  }

  const active = await prisma.timeEntry.findFirst({
    where: { userId: user.id, businessId, clockOut: null },
  });
  if (active) {
    return { error: 'You are already clocked in. Clock out first.' };
  }

  let jobId: string | null = null;
  if (parsed.data.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: parsed.data.jobId, businessId },
    });
    if (!job) return { error: 'Selected job not found.' };
    jobId = job.id;
  }

  await prisma.timeEntry.create({
    data: {
      clockIn: new Date(),
      userId: user.id,
      businessId,
      jobId,
    },
  });

  revalidateTimesheetPaths();
  return { ok: true };
}

/** Clock out the current user's active session. */
export async function clockOut(): Promise<TimesheetResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'clockOut');
  if (limited) return limited;

  const active = await prisma.timeEntry.findFirst({
    where: { userId: user.id, businessId, clockOut: null },
    orderBy: { clockIn: 'desc' },
  });
  if (!active) {
    return { error: 'No active clock-in found.' };
  }

  await prisma.timeEntry.update({
    where: { id: active.id, businessId },
    data: { clockOut: new Date() },
  });

  revalidateTimesheetPaths();
  if (active.jobId) revalidatePath(`/jobs/${active.jobId}`);
  return { ok: true };
}

const manualEntrySchema = z.object({
  userId: z.string().min(1, 'Select a team member.'),
  clockIn: z.string().min(1, 'Start time is required.'),
  clockOut: z.string().min(1, 'End time is required.'),
  jobId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Create a manual time entry. Admins can log for any team member;
 * members can only log for themselves.
 */
export async function createManualEntry(input: {
  userId: string;
  clockIn: string;
  clockOut: string;
  jobId?: string;
  notes?: string;
}): Promise<TimesheetResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'createManualEntry');
  if (limited) return limited;

  const parsed = manualEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid entry details.' };
  }

  if (!isAdmin(user.role) && parsed.data.userId !== user.id) {
    return { error: 'You can only add time entries for yourself.' };
  }

  const member = await prisma.user.findFirst({
    where: { id: parsed.data.userId, businessId },
  });
  if (!member) return { error: 'Team member not found.' };

  const start = new Date(parsed.data.clockIn);
  const end = new Date(parsed.data.clockOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid date/time.' };
  }
  if (end <= start) {
    return { error: 'End time must be after start time.' };
  }
  if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) {
    return { error: 'A single entry cannot exceed 24 hours.' };
  }

  let jobId: string | null = null;
  if (parsed.data.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: parsed.data.jobId, businessId },
    });
    if (!job) return { error: 'Selected job not found.' };
    jobId = job.id;
  }

  await prisma.timeEntry.create({
    data: {
      clockIn: start,
      clockOut: end,
      notes: parsed.data.notes?.trim() || null,
      userId: member.id,
      businessId,
      jobId,
    },
  });

  revalidateTimesheetPaths();
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

/** Delete a time entry. Admins can delete any; members only their own. */
export async function deleteEntry(entryId: string): Promise<TimesheetResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'deleteEntry');
  if (limited) return limited;

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, businessId },
  });
  if (!entry) return { error: 'Entry not found.' };
  if (!isAdmin(user.role) && entry.userId !== user.id) {
    return { error: 'You can only delete your own entries.' };
  }

  await prisma.timeEntry.delete({ where: { id: entryId, businessId } });

  revalidateTimesheetPaths();
  if (entry.jobId) revalidatePath(`/jobs/${entry.jobId}`);
  return { ok: true };
}
