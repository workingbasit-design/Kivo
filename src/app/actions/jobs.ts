'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jobSchema, JOB_STATUSES } from '@/lib/validations';
import { isValidTransition } from '@/lib/job-status';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type JobActionResult = { error?: string; ok?: boolean; queued?: boolean };

async function checkLimit(userId: string, prefix: string): Promise<JobActionResult | null> {
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

async function getOwnedJob(businessId: string, jobId: string) {
  return prisma.job.findFirst({ where: { id: jobId, businessId } });
}

function revalidateJobPaths(jobId?: string) {
  revalidatePath('/jobs');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/**
 * Quick-create a job. Minimal fields so it takes < 20 seconds.
 * Supports inline new-customer creation when customerId === '__NEW__'.
 */
export async function createJob(
  _prev: JobActionResult,
  formData: FormData
): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'createJob');
  if (limited) return limited;

  let customerId = String(formData.get('customerId') ?? '');
  if (customerId === '__NEW__') {
    const name = String(formData.get('newCustomerName') ?? '').trim();
    const phone = String(formData.get('newCustomerPhone') ?? '').trim();
    if (name.length < 2) {
      return { error: 'Enter the customer name (min 2 characters).' };
    }
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { regionCode: true },
    });
    let phoneNorm: string | null = null;
    if (phone) {
      const phoneCheck = validatePhone(phone, business?.regionCode ?? 'CA');
      if (!phoneCheck.ok) return { error: INVALID_PHONE_MESSAGE };
      phoneNorm = phoneCheck.digits;
    }
    const customer = await prisma.customer.create({
      data: { name, phone: phone || null, phoneNorm, businessId },
    });
    customerId = customer.id;
  }

  const parsed = jobSchema.safeParse({
    title: formData.get('title'),
    customerId,
    date: formData.get('date'),
    time: formData.get('time') ?? '',
    address: formData.get('address') ?? '',
    price: formData.get('price'),
    status: 'SCHEDULED',
    notes: formData.get('notes') ?? '',
    technician: formData.get('technician') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid job details.' };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, businessId },
  });
  if (!customer) return { error: 'Selected customer not found.' };

  // Optional price-book service link: tenant-scoped — a service that doesn't
  // belong to this business is ignored rather than failing the whole job.
  let serviceId: string | null = null;
  const rawServiceId = String(formData.get('serviceId') ?? '').trim();
  if (rawServiceId) {
    const service = await prisma.service.findFirst({
      where: { id: rawServiceId, businessId },
      select: { id: true },
    });
    if (service) serviceId = service.id;
  }

  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      customerId: parsed.data.customerId,
      businessId,
      date: parseDateInput(parsed.data.date),
      time: parsed.data.time || null,
      address: parsed.data.address || null,
      price: Math.round(parsed.data.price * 100) / 100, // cents (2026-09-24)
      status: 'SCHEDULED',
      notes: parsed.data.notes || null,
      technician: parsed.data.technician || null,
      serviceId,
    },
  });

  // Optional checklist-template bundle: copy the template's items into the
  // new job. Tenant-scoped — another business's template is ignored.
  const rawTemplateId = String(formData.get('templateId') ?? '').trim();
  if (rawTemplateId) {
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: rawTemplateId, businessId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (template && template.items.length > 0) {
      await prisma.jobChecklistItem.createMany({
        data: template.items.map((item, i) => ({
          jobId: job.id,
          label: item.label,
          done: false,
          sortOrder: i,
        })),
      });
    }
  }

  revalidateJobPaths(job.id);
  redirect(`/jobs/${job.id}`);
}

/** Full edit of a job (status is managed separately via updateJobStatus). */
export async function updateJob(
  _prev: JobActionResult,
  formData: FormData
): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'updateJob');
  if (limited) return limited;

  const id = String(formData.get('id') ?? '');
  const existing = await getOwnedJob(businessId, id);
  if (!existing) return { error: 'Job not found.' };

  const parsed = jobSchema
    .omit({ status: true })
    .safeParse({
      title: formData.get('title'),
      customerId: formData.get('customerId'),
      date: formData.get('date'),
      time: formData.get('time') ?? '',
      address: formData.get('address') ?? '',
      price: formData.get('price'),
      notes: formData.get('notes') ?? '',
      technician: formData.get('technician') ?? '',
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid job details.' };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, businessId },
  });
  if (!customer) return { error: 'Selected customer not found.' };

  await prisma.job.update({
    where: { id },
    data: {
      title: parsed.data.title,
      customerId: parsed.data.customerId,
      date: parseDateInput(parsed.data.date),
      time: parsed.data.time || null,
      address: parsed.data.address || null,
      price: Math.round(parsed.data.price * 100) / 100, // cents (2026-09-24)
      notes: parsed.data.notes || null,
      technician: parsed.data.technician || null,
    },
  });

  revalidateJobPaths(id);
  redirect(`/jobs/${id}`);
}

/**
 * Change a job's status. Enforces forward-only transitions
 * (plus CANCELLED from any non-PAID state, and reopen from CANCELLED).
 */
export async function updateJobStatus(
  jobId: string,
  newStatus: string
): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'updateJobStatus');
  if (limited) return limited;

  if (!(JOB_STATUSES as readonly string[]).includes(newStatus)) {
    return { error: 'Invalid status.' };
  }
  const job = await getOwnedJob(businessId, jobId);
  if (!job) return { error: 'Job not found.' };
  if (!isValidTransition(job.status, newStatus)) {
    return { error: `Cannot move job from ${job.status} to ${newStatus}.` };
  }

  // 2026-09-24: never throw on the write path — an unhandled throw renders a
  // full server-error page instead of the inline error + toast the UI shows.
  try {
    await prisma.job.update({ where: { id: jobId }, data: { status: newStatus } });
  } catch (e) {
    console.error('[jobs] updateJobStatus failed', e);
    return { error: 'Could not update the job. Please try again.' };
  }
  revalidateJobPaths(jobId);
  return { ok: true };
}

/** Reschedule a job: change date/time (and status, subject to transition rules). */
export async function updateJobSchedule(
  jobId: string,
  dateStr: string,
  time: string,
  status: string
): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'updateJobSchedule');
  if (limited) return limited;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { error: 'Invalid date.' };
  }
  if (!(JOB_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Invalid status.' };
  }
  const job = await getOwnedJob(businessId, jobId);
  if (!job) return { error: 'Job not found.' };
  if (!isValidTransition(job.status, status)) {
    return { error: `Cannot move job from ${job.status} to ${status}.` };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      date: parseDateInput(dateStr),
      time: time.trim() || null,
      status,
    },
  });
  revalidateJobPaths(jobId);
  return { ok: true };
}

/** Delete a job (notes & photos cascade). Returns ok; caller navigates. */
export async function deleteJob(jobId: string): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'deleteJob');
  if (limited) return limited;

  const job = await getOwnedJob(businessId, jobId);
  if (!job) return { error: 'Job not found.' };

  await prisma.job.delete({ where: { id: jobId } });
  revalidateJobPaths();
  return { ok: true };
}

const jobNoteSchema = z.object({
  jobId: z.string().min(1),
  content: z.string().trim().min(1, 'Note cannot be empty.').max(2000),
});

/** Add a note to a job. */
export async function addJobNote(
  _prev: JobActionResult,
  formData: FormData
): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'addJobNote');
  if (limited) return limited;

  const parsed = jobNoteSchema.safeParse({
    jobId: formData.get('jobId'),
    content: formData.get('content'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid note.' };
  }

  const job = await getOwnedJob(businessId, parsed.data.jobId);
  if (!job) return { error: 'Job not found.' };

  await prisma.jobNote.create({
    data: {
      content: parsed.data.content,
      jobId: job.id,
      authorId: user.id,
    },
  });

  revalidatePath(`/jobs/${job.id}`);
  return { ok: true };
}

/** Delete a job note. */
export async function deleteJobNote(
  jobId: string,
  noteId: string
): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'deleteJobNote');
  if (limited) return limited;

  const job = await getOwnedJob(businessId, jobId);
  if (!job) return { error: 'Job not found.' };

  const note = await prisma.jobNote.findFirst({
    where: { id: noteId, jobId: job.id },
  });
  if (!note) return { error: 'Note not found.' };

  await prisma.jobNote.delete({ where: { id: noteId } });
  revalidatePath(`/jobs/${job.id}`);
  return { ok: true };
}

/**
 * Create 3 sample jobs so a brand-new business sees the schedule working.
 * Only runs when the business has zero jobs.
 */
export async function seedSampleJobs(): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'seedSampleJobs');
  if (limited) return limited;

  const existing = await prisma.job.count({ where: { businessId } });
  if (existing > 0) {
    return { error: 'You already have jobs — clear them first to reseed.' };
  }

  let customer = await prisma.customer.findFirst({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: 'Martin Roy',
        phone: '+1 416 555 0100',
        address: 'Leslieville, Toronto',
        businessId,
      },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const samples = [
    { title: 'Furnace and AC tune-up', days: 0, time: '10:00 AM', price: 299 },
    { title: 'Bathroom faucet leak repair', days: 0, time: '2:00 PM', price: 189 },
    { title: 'Full home deep cleaning', days: 1, time: '9:00 AM', price: 349 },
  ];

  for (const s of samples) {
    const d = new Date(today);
    d.setDate(d.getDate() + s.days);
    await prisma.job.create({
      data: {
        title: s.title,
        customerId: customer.id,
        businessId,
        date: d,
        time: s.time,
        price: s.price,
        status: 'SCHEDULED',
        address: customer.address,
      },
    });
  }

  revalidateJobPaths();
  return { ok: true };
}
