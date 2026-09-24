'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  DESIGNATION_TYPES,
  designationSchema,
  tradeProfileSchema,
  type DesignationInput,
  type TradeProfileInput,
} from '@/lib/designations';

export type DesignationResult = { error?: string; ok?: boolean; id?: string };

function limited(key: string): DesignationResult | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

async function clientKey(suffix: string): Promise<string> {
  // Mirror the pattern used in auth.ts: per-session key when available.
  const { headers } = await import('next/headers');
  const h = await headers();
  return `${suffix}:${h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'local'}`;
}

function toDateOrNull(v: string): Date | null {
  return v === '' ? null : new Date(v);
}

export async function listDesignations() {
  const { businessId } = await requireAuth();
  return prisma.designation.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      title: true,
      issuer: true,
      number: true,
      issuedAt: true,
      expiresAt: true,
    },
  });
}

export async function createDesignation(input: DesignationInput): Promise<DesignationResult> {
  const hit = limited(await clientKey('designation-create'));
  if (hit) return hit;
  const { businessId } = await requireAuth();
  const parsed = designationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid designation.' };
  }
  const d = parsed.data;
  const created = await prisma.designation.create({
    data: {
      businessId,
      type: d.type,
      title: d.title,
      issuer: d.issuer || null,
      number: d.number || null,
      issuedAt: toDateOrNull(d.issuedAt),
      expiresAt: toDateOrNull(d.expiresAt),
    },
    select: { id: true },
  });
  revalidatePath('/settings');
  revalidatePath('/insights');
  revalidatePath('/dashboard');
  return { ok: true, id: created.id };
}

export async function updateDesignation(
  id: string,
  input: DesignationInput
): Promise<DesignationResult> {
  const hit = limited(await clientKey('designation-update'));
  if (hit) return hit;
  const { businessId } = await requireAuth();
  const parsed = designationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid designation.' };
  }
  const d = parsed.data;
  // Ownership check: the id must belong to the caller's business.
  const existing = await prisma.designation.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { error: 'Designation not found.' };
  await prisma.designation.update({
    where: { id: existing.id },
    data: {
      type: d.type,
      title: d.title,
      issuer: d.issuer || null,
      number: d.number || null,
      issuedAt: toDateOrNull(d.issuedAt),
      expiresAt: toDateOrNull(d.expiresAt),
    },
  });
  revalidatePath('/settings');
  revalidatePath('/insights');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteDesignation(id: string): Promise<DesignationResult> {
  const hit = limited(await clientKey('designation-delete'));
  if (hit) return hit;
  const { businessId } = await requireAuth();
  // Ownership check via scoped delete — deletes 0 rows for foreign ids.
  const res = await prisma.designation.deleteMany({ where: { id, businessId } });
  if (res.count === 0) return { error: 'Designation not found.' };
  revalidatePath('/settings');
  revalidatePath('/insights');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function updateTradeProfile(input: TradeProfileInput): Promise<DesignationResult> {
  const hit = limited(await clientKey('trade-profile'));
  if (hit) return hit;
  const { businessId } = await requireAuth();
  const parsed = tradeProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid profile.' };
  }
  const d = parsed.data;
  await prisma.business.update({
    where: { id: businessId },
    data: {
      trade: d.trade === '' ? null : d.trade,
      yearsInBusiness: d.yearsInBusiness ?? null,
      specialties: JSON.stringify(d.specialties),
    },
  });
  revalidatePath('/settings');
  revalidatePath('/insights');
  revalidatePath('/dashboard');
  return { ok: true };
}
