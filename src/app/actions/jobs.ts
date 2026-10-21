'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { jobSchema, JOB_STATUSES } from '@/lib/validations';
import { isValidTransition, deriveJobWindow } from '@/lib/job-status';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { normalizeJobTime, parseDateInputInTimezone } from '@/lib/utils';
import { dollarsToCents } from '@/lib/money';

export type JobActionResult = { error?: string; ok?: boolean; queued?: boolean };

async function checkLimit(userId: string, prefix: string): Promise<JobActionResult | null> {
  const rl = rateLimit(`${prefix}:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

/**
 * Business timezone for date-input parsing. Dates entered as 'YYYY-MM-DD'
 * are midnight in the BUSINESS's timezone, not the server's (Vercel runs
 * UTC - parsing server-local shifted Oct-16 jobs back to Oct 15 in the
 * attention engine's business-tz day keys; 2026-10-16 morning-QA finding).
 */
async function businessTimeZone(businessId: string): Promise<string> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  return b?.timezone || 'America/Toronto';
}

async function getOwnedJob(businessId: string, jobId: string) {
  return prisma.job.findFirst({ where: { id: jobId, businessId } });
}

/**
 * The scheduled length to keep when re-deriving a job's window on edit:
 * the length of the window already stored (e.g. from a price-book
 * service's duration), so rescheduling a 2-hour job keeps it 2 hours.
 * Undefined when no window was stored — deriveJobWindow then applies
 * the standard length.
 */
function preservedDurationMinutes(job: {
  startAt: Date | null;
  endAt: Date | null;
}): number | undefined {
  if (job.startAt && job.endAt) {
    const mins = Math.round(
      (job.endAt.getTime() - job.startAt.getTime()) / 60_000
    );
    if (mins > 0) return mins;
  }
  return undefined;
}

function revalidateJobPaths(jobId?: string) {
  revalidatePath('/jobs');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  revalidatePath('/voice');
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

  const noCharge = formData.get('noCharge') === 'on';
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
  // Zero-price requires explicit no-charge opt-in
  if (parsed.success && parsed.data.price === 0 && !noCharge) {
    return { error: 'Enter a price or tick "No charge" for warranty callbacks and similar.' };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid job details.' };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, businessId },
  });
  if (!customer) return { error: 'Selected customer not found.' };

  // Optional price-book service link: tenant-scoped - a service that doesn't
  // belong to this business is ignored rather than failing the whole job.
  // The service's duration (when set) becomes the job's scheduled length.
  let serviceId: string | null = null;
  let serviceDurationMin: number | null = null;
  const rawServiceId = String(formData.get('serviceId') ?? '').trim();
  if (rawServiceId) {
    const service = await prisma.service.findFirst({
      where: { id: rawServiceId, businessId },
      select: { id: true, durationMin: true },
    });
    if (service) {
      serviceId = service.id;
      serviceDurationMin = service.durationMin;
    }
  }

  // Optional crew link: tenant-scoped - a crew that doesn't belong to this
  // business is ignored rather than failing the whole job.
  let crewId: string | null = null;
  const rawCrewId = String(formData.get('crewId') ?? '').trim();
  if (rawCrewId) {
    const crew = await prisma.crew.findFirst({
      where: { id: rawCrewId, businessId },
      select: { id: true },
    });
    if (crew) crewId = crew.id;
  }

  const tz = await businessTimeZone(businessId);
  const dateValue = parseDateInputInTimezone(parsed.data.date, tz);
  const timeNorm = normalizeJobTime(parsed.data.time);
  // D2 fix (2026-10-21): persist the canonical window. Before this, no
  // create/edit path ever wrote startAt/endAt, so end-based states
  // ("Running over") were unreachable for UI-created jobs.
  const jobWindow = deriveJobWindow(
    { date: dateValue, time: timeNorm },
    serviceDurationMin ?? undefined,
  );
  const job = await prisma.job.create({
    data: {
      title: parsed.data.title,
      customerId: parsed.data.customerId,
      businessId,
      date: dateValue,
      time: timeNorm,
      startAt: jobWindow.startAt,
      endAt: jobWindow.endAt,
      address: parsed.data.address || null,
      priceCents: dollarsToCents(parsed.data.price) ?? BigInt(0),
      noCharge,
      status: 'SCHEDULED',
      notes: parsed.data.notes || null,
      technician: parsed.data.technician || null,
      crewId,
      serviceId,
    },
  });

  // Optional checklist-template bundle: copy the template's items into the
  // new job. Tenant-scoped - another business's template is ignored.
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
  // Outgoing webhook: job created. Best-effort - never fails creation.
  try {
    const { emitWebhookEvent } = await import('@/lib/webhooks');
    await emitWebhookEvent(businessId, 'job.created', {
      job_id: job.id,
      title: job.title,
      customer_id: job.customerId,
      status: job.status,
    });
  } catch (err) {
    logger.error('jobs: job.created webhook failed', { businessId, jobId: job.id, error: err });
  }
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

  const noCharge = formData.get('noCharge') === 'on';
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
  if (parsed.data.price === 0 && !noCharge) {
    return { error: 'Enter a price or tick "No charge" for warranty callbacks and similar.' };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, businessId },
  });
  if (!customer) return { error: 'Selected customer not found.' };

  // Optional crew link: tenant-scoped - a crew that doesn't belong to this
  // business is ignored rather than failing the whole update. Only touched
  // when the form actually rendered the crew select (formData.has).
  const crewUpdate: { crewId?: string | null } = {};
  if (formData.has('crewId')) {
    let crewId: string | null = null;
    const rawCrewId = String(formData.get('crewId') ?? '').trim();
    if (rawCrewId) {
      const crew = await prisma.crew.findFirst({
        where: { id: rawCrewId, businessId },
        select: { id: true },
      });
      if (crew) crewId = crew.id;
    }
    crewUpdate.crewId = crewId;
  }

  const tz = await businessTimeZone(businessId);
  const dateValue = parseDateInputInTimezone(parsed.data.date, tz);
  const timeNorm = normalizeJobTime(parsed.data.time);
  // D2 fix (2026-10-21): keep the canonical window in sync with the
  // edited schedule, preserving the stored window's length.
  const jobWindow = deriveJobWindow(
    { date: dateValue, time: timeNorm },
    preservedDurationMinutes(existing)
  );
  await prisma.job.update({
    where: { id, businessId },
    data: {
      title: parsed.data.title,
      customerId: parsed.data.customerId,
      date: dateValue,
      time: timeNorm,
      startAt: jobWindow.startAt,
      endAt: jobWindow.endAt,
      address: parsed.data.address || null,
      priceCents: dollarsToCents(parsed.data.price) ?? BigInt(0),
      noCharge,
      notes: parsed.data.notes || null,
      technician: parsed.data.technician || null,
      ...crewUpdate,
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

  // 2026-09-24: never throw on the write path - an unhandled throw renders a
  // full server-error page instead of the inline error + toast the UI shows.
  // 2026-10-01: marking PAID settles the money in the same transaction -
  // without this, "Collected" and the monthly revenue bars (payment-based)
  // disagreed with the job status and the job-based earnings numbers.
  try {
    if (newStatus === 'PAID') {
      const { settleJobPaid } = await import('./invoices');
      await prisma.$transaction(async (tx) => {
        await tx.job.update({ where: { id: jobId, businessId }, data: { status: newStatus } });
        await settleJobPaid(businessId, jobId, tx);
      });
    } else {
      await prisma.job.update({ where: { id: jobId, businessId }, data: { status: newStatus } });
    }
  } catch (e) {
    logger.error('jobs: updateJobStatus failed', { businessId, jobId, error: e });
    return { error: 'Could not update the job. Please try again.' };
  }
  revalidateJobPaths(jobId);
  // Outgoing webhook: job completed. Best-effort - never fails the update.
  if (newStatus === 'COMPLETED') {
    try {
      const { emitWebhookEvent } = await import('@/lib/webhooks');
      await emitWebhookEvent(businessId, 'job.completed', {
        job_id: jobId,
        title: job.title,
        customer_id: job.customerId ?? null,
      });
    } catch (err) {
      logger.error('jobs: job.completed webhook failed', { businessId, jobId, error: err });
    }
  }
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

  const tz = await businessTimeZone(businessId);
  const dateValue = parseDateInputInTimezone(dateStr, tz);
  const timeNorm = normalizeJobTime(time);
  // D2 fix (2026-10-21): rescheduling moves the canonical window too.
  const jobWindow = deriveJobWindow(
    { date: dateValue, time: timeNorm },
    preservedDurationMinutes(job)
  );
  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId, businessId },
      data: {
        date: dateValue,
        time: timeNorm,
        startAt: jobWindow.startAt,
        endAt: jobWindow.endAt,
        status,
      },
    });
    // 2026-10-01: marking PAID settles the money so earnings numbers agree.
    if (status === 'PAID') {
      const { settleJobPaid } = await import('./invoices');
      await settleJobPaid(businessId, jobId, tx);
    }
  });
  revalidateJobPaths(jobId);
  if (status === 'COMPLETED') {
    try {
      const { emitWebhookEvent } = await import('@/lib/webhooks');
      await emitWebhookEvent(businessId, 'job.completed', {
        job_id: jobId,
        title: job.title,
        customer_id: job.customerId ?? null,
      });
    } catch (err) {
      // TODO(logging): migrate to structured logger (src/lib/logger.ts)
      console.error('[jobs] job.completed webhook failed', err);
    }
  }
  return { ok: true };
}

/** Delete a job (notes & photos cascade). Returns ok; caller navigates. */
export async function deleteJob(jobId: string): Promise<JobActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'deleteJob');
  if (limited) return limited;

  const job = await getOwnedJob(businessId, jobId);
  if (!job) return { error: 'Job not found.' };

  await prisma.job.delete({ where: { id: jobId, businessId } });
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
  revalidatePath('/voice');
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
    return { error: 'You already have jobs - clear them first to reseed.' };
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
    { title: 'Furnace and AC tune-up', days: 0, time: '10:00', price: 299 },
    { title: 'Bathroom faucet leak repair', days: 0, time: '14:00', price: 189 },
    { title: 'Full home deep cleaning', days: 1, time: '09:00', price: 349 },
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
        priceCents: dollarsToCents(s.price) ?? BigInt(0),
        status: 'SCHEDULED',
        address: customer.address,
      },
    });
  }

  revalidateJobPaths();
  return { ok: true };
}
