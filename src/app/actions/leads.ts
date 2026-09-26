'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { leadSchema, LEAD_STATUSES } from '@/lib/validations';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';

export type ActionResult = { error?: string; ok?: boolean };

async function checkLimit(userId: string): Promise<ActionResult | null> {
  const rl = rateLimit(`lead:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

function nullIfEmpty(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

/** Create a lead for the current business. */
export async function createLead(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const parsed = leadSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    details: formData.get('details'),
    source: formData.get('source'),
    status: formData.get('status') ?? 'NEW',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }
  const { name, phone, email, details, source, status } = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true },
  });
  const phoneCheck = validatePhone(phone, business?.regionCode ?? 'CA');
  if (!phoneCheck.ok) return { error: INVALID_PHONE_MESSAGE };

  await prisma.lead.create({
    data: {
      name,
      phone: nullIfEmpty(phone),
      phoneNorm: phoneCheck.digits,
      email: nullIfEmpty(email),
      details: nullIfEmpty(details),
      source: nullIfEmpty(source),
      status,
      businessId,
    },
  });

  revalidatePath('/leads');
  return { ok: true };
}

/** Move a lead to a new status (must belong to the current business). */
export async function updateLeadStatus(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');

  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Invalid status.' };
  }

  const existing = await prisma.lead.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { error: 'Lead not found.' };

  await prisma.lead.update({ where: { id, businessId }, data: { status } });

  revalidatePath('/leads');
  return { ok: true };
}

/** Delete a lead (must belong to the current business). */
export async function deleteLead(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const id = String(formData.get('id') ?? '');

  const existing = await prisma.lead.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { error: 'Lead not found.' };

  await prisma.lead.delete({ where: { id, businessId } });

  revalidatePath('/leads');
  return { ok: true };
}
