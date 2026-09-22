'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { formatMoney } from '@/lib/money';
import {
  type Audience,
  AUDIENCE_LABELS,
  renderTemplate,
} from '@/lib/marketing';

export type MarketingResult = { error?: string; ok?: boolean; id?: string };

const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Give the campaign a name.').max(120),
  subject: z.string().trim().min(1, 'Add a subject line.').max(160),
  body: z.string().trim().min(1, 'Write the message body.').max(4000),
  audience: z.enum(['ALL_CUSTOMERS', 'WITH_UNPAID', 'RECENT_JOBS']),
});

function limited(businessId: string): MarketingResult | null {
  const rl = rateLimit(`marketing:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

/** Resolve the recipient customers for an audience. Tenant-isolated. */
export async function getAudienceRecipients(
  businessId: string,
  audience: Audience
): Promise<{ id: string; name: string; phone: string | null }[]> {
  if (audience === 'ALL_CUSTOMERS') {
    return prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    });
  }
  if (audience === 'WITH_UNPAID') {
    const invoices = await prisma.invoice.findMany({
      where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const ids = invoices.map((i) => i.customerId);
    if (ids.length === 0) return [];
    return prisma.customer.findMany({
      where: { id: { in: ids }, businessId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    });
  }
  // RECENT_JOBS: customers with a job in the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.job.findMany({
    where: { businessId, date: { gte: since } },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const ids = jobs.map((j) => j.customerId);
  if (ids.length === 0) return [];
  return prisma.customer.findMany({
    where: { id: { in: ids }, businessId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true },
  });
}

/** Create a campaign (DRAFT). For useActionState. */
export async function createCampaign(
  _prev: MarketingResult,
  formData: FormData
): Promise<MarketingResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const parsed = campaignSchema.safeParse({
    name: formData.get('name'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    audience: formData.get('audience'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid campaign details.' };
  }

  const campaign = await prisma.campaign.create({
    data: { ...parsed.data, status: 'DRAFT', businessId },
  });
  revalidatePath('/marketing');
  return { ok: true, id: campaign.id };
}

/** Update a DRAFT campaign. For useActionState. */
export async function updateCampaign(
  _prev: MarketingResult,
  formData: FormData
): Promise<MarketingResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const id = String(formData.get('id') ?? '');
  const parsed = campaignSchema.safeParse({
    name: formData.get('name'),
    subject: formData.get('subject'),
    body: formData.get('body'),
    audience: formData.get('audience'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid campaign details.' };
  }

  const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
  if (!existing) return { error: 'Campaign not found.' };
  if (existing.status !== 'DRAFT') {
    return { error: 'Only draft campaigns can be edited.' };
  }

  await prisma.campaign.update({ where: { id }, data: parsed.data });
  revalidatePath('/marketing');
  revalidatePath(`/marketing/${id}`);
  return { ok: true, id };
}

/** Delete a campaign. */
export async function deleteCampaign(id: string): Promise<MarketingResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
  if (!existing) return { error: 'Campaign not found.' };

  await prisma.campaign.delete({ where: { id } });
  revalidatePath('/marketing');
  return { ok: true };
}

/**
 * Move a campaign DRAFT -> QUEUED or QUEUED -> SENT.
 * QUEUED means "ready for you to copy and send manually" — Kivo never
 * sends messages itself. There is no sending infrastructure by design.
 */
export async function advanceCampaignStatus(id: string): Promise<MarketingResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
  if (!existing) return { error: 'Campaign not found.' };

  const next =
    existing.status === 'DRAFT' ? 'QUEUED' : existing.status === 'QUEUED' ? 'SENT' : null;
  if (!next) return { error: 'Campaign is already sent.' };

  await prisma.campaign.update({ where: { id }, data: { status: next } });
  revalidatePath('/marketing');
  revalidatePath(`/marketing/${id}`);
  return { ok: true };
}

/** Preview an audience: recipient count + a small sample. Called directly from the client. */
export async function previewAudience(
  audience: Audience
): Promise<{ count: number; sample: { name: string; phone: string | null }[] } | { error: string }> {
  const { businessId } = await requireAuth();
  const recipients = await getAudienceRecipients(businessId, audience);
  return {
    count: recipients.length,
    sample: recipients.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone })),
  };
}

/**
 * Build a polite, copy-paste payment reminder for an invoice.
 * Never sends anything — returns draft text only. UPI ID is text only.
 */
export async function draftPaymentReminder(
  invoiceId: string
): Promise<{ text?: string; error?: string }> {
  const { businessId } = await requireAuth();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: {
      customer: { select: { name: true } },
      payments: { select: { amount: true } },
      business: { select: { name: true, upiId: true, phone: true, currency: true } },
    },
  });
  if (!invoice) return { error: 'Invoice not found.' };

  const paid = Math.round(invoice.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const remaining = Math.round((invoice.total - paid) * 100) / 100;
  if (remaining <= 0) return { error: 'This invoice is already fully paid.' };

  const upiLine = invoice.business.upiId
    ? ` You can pay via UPI to ${invoice.business.upiId}.`
    : '';
  const text =
    `Namaste ${invoice.customer.name}, this is a gentle reminder from ${invoice.business.name} ` +
    `that invoice ${invoice.number} for ${formatMoney(remaining, invoice.business.currency)} is still pending.${upiLine} ` +
    `Thank you!`;
  return { text };
}

const publicReviewSchema = z.object({
  businessId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
  customerName: z.string().trim().max(120).optional().default(''),
});

/**
 * Public review submission — NO auth (used by the /r/[businessId] page).
 * Only ever reveals the business name; never leaks customer/job data.
 */
export async function createPublicReview(
  _prev: MarketingResult,
  formData: FormData
): Promise<MarketingResult> {
  const parsed = publicReviewSchema.safeParse({
    businessId: formData.get('businessId'),
    rating: formData.get('rating'),
    comment: formData.get('comment'),
    customerName: formData.get('customerName'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please pick a star rating.' };
  }
  const { businessId, rating, comment, customerName } = parsed.data;

  const hit = rateLimit(`public-review:${businessId}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!hit.ok) return { error: 'Too many reviews. Please try again later.' };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) return { error: 'This review link is not valid.' };

  // Prefix the comment with the reviewer's name if given (no customer linking —
  // we can't verify identity on a public form).
  const storedComment =
    [customerName ? `— ${customerName}` : null, comment || null].filter(Boolean).join('\n') || null;

  await prisma.review.create({
    data: {
      rating,
      comment: storedComment,
      source: 'Direct',
      businessId: business.id,
    },
  });
  return { ok: true };
}
