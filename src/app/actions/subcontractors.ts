'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { clientIpFromHeaders } from '@/lib/client-ip';

export type SubcontractorErrorCode =
  | 'tooMany'
  | 'login'
  | 'notFound'
  | 'invalidName'
  | 'invalidContact'
  | 'invalidRate'
  | 'invalidHours'
  | 'invalidAmount'
  | 'hasPayouts'
  | 'saveFailed'
  | 'deleteFailed';

export type SubcontractorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  defaultRateCents: number | null;
  note: string | null;
  jobCount: number;
};

export type JobSubRow = {
  id: string;
  subcontractorId: string;
  name: string;
  hours: number | null;
  amountCents: number | null;
  note: string | null;
};

export type SubcontractorResult =
  | { ok: true; subcontractors?: SubcontractorRow[]; subcontractor?: SubcontractorRow; jobSubs?: JobSubRow[] }
  | { ok: false; error: SubcontractorErrorCode };

const MAX_NAME = 100;
const MAX_PHONE = 40;
const MAX_EMAIL = 200;
const MAX_NOTE = 2000;

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  return `${prefix}:${ip}`;
}

function checkLimit(key: string): SubcontractorErrorCode | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  return rl.ok ? null : 'tooMany';
}

/** A subcontractor row owned by the caller's business. */
async function ownedSub(businessId: string, id: string) {
  return prisma.subcontractor.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
}

/** A job owned by the caller's business. */
async function ownedJob(businessId: string, jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true },
  });
}

function toRow(s: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  defaultRateCents: bigint | null;
  note: string | null;
  _count?: { jobs: number };
}): SubcontractorRow {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    defaultRateCents: s.defaultRateCents != null ? Number(s.defaultRateCents) : null,
    note: s.note,
    jobCount: s._count?.jobs ?? 0,
  };
}

function validateSubFields(input: {
  name: unknown;
  phone?: unknown;
  email?: unknown;
  defaultRate?: unknown;
  note?: unknown;
}):
  | { name: string; phone: string | null; email: string | null; defaultRateCents: bigint | null; note: string | null }
  | { error: SubcontractorErrorCode } {
  const name = String(input.name ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  const email = String(input.email ?? '').trim();
  const note = String(input.note ?? '').trim();
  if (!name || name.length > MAX_NAME) return { error: 'invalidName' };
  if (phone.length > MAX_PHONE || email.length > MAX_EMAIL) return { error: 'invalidContact' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'invalidContact' };
  if (note.length > MAX_NOTE) return { error: 'invalidContact' };
  const rateRaw = String(input.defaultRate ?? '').trim();
  if (rateRaw === '') return { name, phone: phone || null, email: email || null, defaultRateCents: null, note: note || null };
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'invalidRate' };
  return { name, phone: phone || null, email: email || null, defaultRateCents: BigInt(Math.round(rate * 100)), note: note || null };
}

/** Parse an optional non-negative number (hours / payout dollars). Blank = null. */
function parseNonNegative(raw: unknown, err: SubcontractorErrorCode): { value: number | null } | { error: SubcontractorErrorCode } {
  const s = String(raw ?? '').trim();
  if (s === '') return { value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { error: err };
  return { value: n };
}

export async function listSubcontractors(): Promise<SubcontractorResult> {
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  const rows = await prisma.subcontractor.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { jobs: true } } },
  });
  return { ok: true, subcontractors: rows.map(toRow) };
}

export async function createSubcontractor(input: {
  name: unknown;
  phone?: unknown;
  email?: unknown;
  defaultRate?: unknown;
  note?: unknown;
}): Promise<SubcontractorResult> {
  const limited = checkLimit(await clientKey('subs:create'));
  if (limited) return { ok: false, error: limited };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  const v = validateSubFields(input);
  if ('error' in v) return { ok: false, error: v.error };
  try {
    const created = await prisma.subcontractor.create({
      data: { businessId, name: v.name, phone: v.phone, email: v.email, defaultRateCents: v.defaultRateCents, note: v.note },
      include: { _count: { select: { jobs: true } } },
    });
    revalidatePath('/subcontractors');
    return { ok: true, subcontractor: toRow(created) };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

export async function updateSubcontractor(
  id: string,
  input: { name: unknown; phone?: unknown; email?: unknown; defaultRate?: unknown; note?: unknown },
): Promise<SubcontractorResult> {
  const limited = checkLimit(await clientKey('subs:update'));
  if (limited) return { ok: false, error: limited };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  if (!(await ownedSub(businessId, id))) return { ok: false, error: 'notFound' };
  const v = validateSubFields(input);
  if ('error' in v) return { ok: false, error: v.error };
  try {
    // Tenant guard requires where.businessId on tenant models, and Prisma
    // update() needs a unique where — so updateMany + refetch (the scoped
    // pattern used by designations/expenses deletes).
    const res = await prisma.subcontractor.updateMany({
      where: { id, businessId },
      data: { name: v.name, phone: v.phone, email: v.email, defaultRateCents: v.defaultRateCents, note: v.note },
    });
    if (res.count === 0) return { ok: false, error: 'notFound' };
    const updated = await prisma.subcontractor.findFirst({
      where: { id, businessId },
      include: { _count: { select: { jobs: true } } },
    });
    if (!updated) return { ok: false, error: 'notFound' };
    revalidatePath('/subcontractors');
    return { ok: true, subcontractor: toRow(updated) };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

/** Delete is BLOCKED while any job assignment exists — payout history is never silently destroyed. */
export async function deleteSubcontractor(id: string): Promise<SubcontractorResult> {
  const limited = checkLimit(await clientKey('subs:delete'));
  if (limited) return { ok: false, error: limited };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  if (!(await ownedSub(businessId, id))) return { ok: false, error: 'notFound' };
  const refs = await prisma.jobSubcontractor.count({ where: { subcontractorId: id } });
  if (refs > 0) return { ok: false, error: 'hasPayouts' };
  try {
    // Scoped deleteMany: the tenant guard blocks delete({where:{id}}) on
    // tenant models, and delete() needs a unique where anyway.
    const res = await prisma.subcontractor.deleteMany({ where: { id, businessId } });
    if (res.count === 0) return { ok: false, error: 'notFound' };
    revalidatePath('/subcontractors');
    return { ok: true };
  } catch {
    return { ok: false, error: 'deleteFailed' };
  }
}

export async function listJobSubcontractors(jobId: string): Promise<SubcontractorResult> {
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  if (!(await ownedJob(businessId, jobId))) return { ok: false, error: 'notFound' };
  const rows = await prisma.jobSubcontractor.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    include: { subcontractor: { select: { name: true } } },
  });
  return {
    ok: true,
    jobSubs: rows.map((r) => ({
      id: r.id,
      subcontractorId: r.subcontractorId,
      name: r.subcontractor.name,
      hours: r.hours,
      amountCents: r.amountCents != null ? Number(r.amountCents) : null,
      note: r.note,
    })),
  };
}

export async function assignSubcontractor(
  jobId: string,
  subcontractorId: string,
  input: { hours?: unknown; amount?: unknown; note?: unknown },
): Promise<SubcontractorResult> {
  const limited = checkLimit(await clientKey('subs:assign'));
  if (limited) return { ok: false, error: limited };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  if (!(await ownedJob(businessId, jobId))) return { ok: false, error: 'notFound' };
  if (!(await ownedSub(businessId, subcontractorId))) return { ok: false, error: 'notFound' };
  const hours = parseNonNegative(input.hours, 'invalidHours');
  if ('error' in hours) return { ok: false, error: hours.error };
  const amount = parseNonNegative(input.amount, 'invalidAmount');
  if ('error' in amount) return { ok: false, error: amount.error };
  const note = String(input.note ?? '').trim();
  if (note.length > MAX_NOTE) return { ok: false, error: 'invalidContact' };
  try {
    await prisma.jobSubcontractor.upsert({
      where: { jobId_subcontractorId: { jobId, subcontractorId } },
      update: { hours: hours.value, amountCents: amount.value != null ? BigInt(Math.round(amount.value * 100)) : null, note: note || null },
      create: { jobId, subcontractorId, hours: hours.value, amountCents: amount.value != null ? BigInt(Math.round(amount.value * 100)) : null, note: note || null },
    });
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

export async function removeSubcontractorFromJob(jobId: string, subcontractorId: string): Promise<SubcontractorResult> {
  const limited = checkLimit(await clientKey('subs:remove'));
  if (limited) return { ok: false, error: limited };
  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }
  if (!(await ownedJob(businessId, jobId))) return { ok: false, error: 'notFound' };
  if (!(await ownedSub(businessId, subcontractorId))) return { ok: false, error: 'notFound' };
  try {
    await prisma.jobSubcontractor.delete({ where: { jobId_subcontractorId: { jobId, subcontractorId } } });
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'deleteFailed' };
  }
}
