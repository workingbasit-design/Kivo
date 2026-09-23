'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  validateExpenseInput,
  parseHourlyRateInput,
  validateChecklistLabel,
  parseTemplateItemLines,
} from '@/lib/costing';
import {
  parseTemplateBundleFields,
  type TemplateBundleFields,
} from '@/lib/template-bundle';

export type JobOpsActionResult = { error?: string; ok?: boolean };

async function checkLimit(userId: string): Promise<JobOpsActionResult | null> {
  const rl = rateLimit(`jobops:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'jobops.errors.tooManyRequests') };
  }
  return null;
}

/** Localized error helper: key relative to jobops.errors. */
async function err(key: string): Promise<JobOpsActionResult> {
  const locale: Locale = await getLocale();
  return { error: t(locale, `jobops.errors.${key}`) };
}

/** Inline EN/FR error for the new bundle fields (i18n files are shared). */
async function errBundle(en: string, fr: string): Promise<JobOpsActionResult> {
  const locale: Locale = await getLocale();
  return { error: locale === 'fr' ? fr : en };
}

/** Parse optional price/durationMin/notes from the template form; error or fields. */
async function parseBundle(
  formData: FormData
): Promise<{ fields?: TemplateBundleFields; error?: JobOpsActionResult }> {
  const parsed = parseTemplateBundleFields({
    price: formData.get('price'),
    durationMin: formData.get('durationMin'),
    notes: formData.get('notes'),
  });
  if (!parsed.ok) return { error: await errBundle(parsed.errorEn, parsed.errorFr) };
  return { fields: parsed.data };
}

/** Tenant-scoped job fetch; null when the job belongs to another business. */
function getOwnedJob(businessId: string, jobId: string) {
  return prisma.job.findFirst({ where: { id: jobId, businessId } });
}

function getOwnedTemplate(businessId: string, templateId: string) {
  return prisma.checklistTemplate.findFirst({
    where: { id: templateId, businessId },
  });
}

function revalidateJob(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs');
  revalidatePath('/dashboard');
}

/* ------------------------------------------------------------------ */
/* Checklist templates (settings)                                      */
/* ------------------------------------------------------------------ */

export async function createChecklistTemplate(
  _prev: JobOpsActionResult,
  formData: FormData
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) return err('templateNameRequired');
  const items = parseTemplateItemLines(formData.get('items'));
  if (items.length === 0) return err('templateItemsRequired');
  const { fields, error: bundleError } = await parseBundle(formData);
  if (bundleError || !fields) return bundleError ?? err('notFound');

  await prisma.checklistTemplate.create({
    data: {
      businessId,
      name,
      price: fields.price,
      durationMin: fields.durationMin,
      notes: fields.notes,
      items: { create: items.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
  revalidatePath('/settings/checklists');
  return { ok: true };
}

export async function updateChecklistTemplate(
  _prev: JobOpsActionResult,
  formData: FormData
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const id = String(formData.get('id') ?? '');
  const template = await getOwnedTemplate(businessId, id);
  if (!template) return err('notFound');

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) return err('templateNameRequired');
  const items = parseTemplateItemLines(formData.get('items'));
  if (items.length === 0) return err('templateItemsRequired');
  const { fields, error: bundleError } = await parseBundle(formData);
  if (bundleError || !fields) return bundleError ?? err('notFound');

  await prisma.$transaction([
    prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } }),
    prisma.checklistTemplate.update({
      where: { id },
      data: {
        name,
        price: fields.price,
        durationMin: fields.durationMin,
        notes: fields.notes,
        items: { create: items.map((label, i) => ({ label, sortOrder: i })) },
      },
    }),
  ]);
  revalidatePath('/settings/checklists');
  return { ok: true };
}

export async function deleteChecklistTemplate(
  templateId: string
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const template = await getOwnedTemplate(businessId, templateId);
  if (!template) return err('notFound');

  await prisma.checklistTemplate.delete({ where: { id: templateId } });
  revalidatePath('/settings/checklists');
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Job checklist                                                       */
/* ------------------------------------------------------------------ */

/** Copy a template's items into the job as JobChecklistItem rows (appended). */
export async function applyChecklistTemplate(
  jobId: string,
  templateId: string
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const job = await getOwnedJob(businessId, jobId);
  if (!job) return err('notFound');
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, businessId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!template) return err('notFound');

  const max = await prisma.jobChecklistItem.aggregate({
    where: { jobId },
    _max: { sortOrder: true },
  });
  const base = (max._max.sortOrder ?? -1) + 1;

  await prisma.jobChecklistItem.createMany({
    data: template.items.map((item, i) => ({
      jobId,
      label: item.label,
      done: false,
      sortOrder: base + i,
    })),
  });
  revalidateJob(jobId);
  return { ok: true };
}

export async function addChecklistItem(
  _prev: JobOpsActionResult,
  formData: FormData
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const jobId = String(formData.get('jobId') ?? '');
  const job = await getOwnedJob(businessId, jobId);
  if (!job) return err('notFound');

  const label = validateChecklistLabel(formData.get('label'));
  if (!label.ok) return err(label.error);

  const count = await prisma.jobChecklistItem.count({ where: { jobId } });
  await prisma.jobChecklistItem.create({
    data: { jobId, label: label.data, done: false, sortOrder: count },
  });
  revalidateJob(jobId);
  return { ok: true };
}

export async function toggleChecklistItem(
  itemId: string,
  done: boolean
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const item = await prisma.jobChecklistItem.findFirst({
    where: { id: itemId, job: { businessId } },
    select: { id: true, jobId: true },
  });
  if (!item) return err('notFound');

  await prisma.jobChecklistItem.update({ where: { id: item.id }, data: { done } });
  revalidateJob(item.jobId);
  return { ok: true };
}

export async function deleteChecklistItem(
  itemId: string
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const item = await prisma.jobChecklistItem.findFirst({
    where: { id: itemId, job: { businessId } },
    select: { id: true, jobId: true },
  });
  if (!item) return err('notFound');

  await prisma.jobChecklistItem.delete({ where: { id: item.id } });
  revalidateJob(item.jobId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

export async function addExpense(
  _prev: JobOpsActionResult,
  formData: FormData
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const jobId = String(formData.get('jobId') ?? '');
  const job = await getOwnedJob(businessId, jobId);
  if (!job) return err('notFound');

  const parsed = validateExpenseInput({
    description: formData.get('description'),
    amount: formData.get('amount'),
    category: formData.get('category'),
    spentAt: formData.get('spentAt'),
  });
  if (!parsed.ok) return err(parsed.error);

  await prisma.jobExpense.create({
    data: { jobId, businessId, ...parsed.data },
  });
  revalidateJob(jobId);
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const expense = await prisma.jobExpense.findFirst({
    where: { id: expenseId, businessId },
    select: { id: true, jobId: true },
  });
  if (!expense) return err('notFound');

  await prisma.jobExpense.delete({ where: { id: expense.id } });
  revalidateJob(expense.jobId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Hourly rate (job costing)                                           */
/* ------------------------------------------------------------------ */

export async function saveHourlyRate(
  _prev: JobOpsActionResult,
  formData: FormData
): Promise<JobOpsActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const parsed = parseHourlyRateInput(formData.get('rate'));
  if (!parsed.ok) return err(parsed.error);

  await prisma.business.update({
    where: { id: businessId },
    data: { defaultHourlyRate: parsed.data },
  });
  revalidatePath('/jobs');
  revalidatePath('/dashboard');
  const jobId = String(formData.get('jobId') ?? '');
  if (jobId) revalidateJob(jobId);
  return { ok: true };
}
