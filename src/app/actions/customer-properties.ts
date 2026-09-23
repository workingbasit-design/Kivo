'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type PropertyErrorCode =
  | 'tooMany'
  | 'login'
  | 'notFound'
  | 'invalidLabel'
  | 'invalidAddress'
  | 'invalidNotes'
  | 'saveFailed'
  | 'deleteFailed';

export type PropertyRow = {
  id: string;
  label: string;
  address: string;
  notes: string | null;
  isPrimary: boolean;
};

export type PropertyResult =
  | { ok: true; properties?: PropertyRow[]; property?: PropertyRow }
  | { ok: false; error: PropertyErrorCode };

const MAX_LABEL = 60;
const MAX_ADDRESS = 500;
const MAX_NOTES = 2000;

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function checkLimit(key: string): PropertyErrorCode | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  return rl.ok ? null : 'tooMany';
}

/** The customer must belong to the caller's business. */
async function ownedCustomer(businessId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
}

/** A property row owned by the caller's business. */
async function ownedProperty(businessId: string, id: string) {
  return prisma.customerProperty.findFirst({
    where: { id, businessId },
    select: { id: true, customerId: true },
  });
}

function validatePropertyFields(input: {
  label: unknown;
  address: unknown;
  notes?: unknown;
}): { label: string; address: string; notes: string | null } | { error: PropertyErrorCode } {
  const label = String(input.label ?? '').trim();
  const address = String(input.address ?? '').trim();
  const notesRaw = String(input.notes ?? '').trim();
  if (!label || label.length > MAX_LABEL) return { error: 'invalidLabel' };
  if (!address || address.length > MAX_ADDRESS) return { error: 'invalidAddress' };
  if (notesRaw.length > MAX_NOTES) return { error: 'invalidNotes' };
  return { label, address, notes: notesRaw ? notesRaw : null };
}

/** List a customer's properties (primary first), tenant-scoped. */
export async function listProperties(customerId: string): Promise<PropertyResult> {
  const limited = checkLimit(await clientKey('props:list'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const customer = await ownedCustomer(businessId, customerId);
  if (!customer) return { ok: false, error: 'notFound' };

  const properties = await prisma.customerProperty.findMany({
    where: { customerId, businessId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, label: true, address: true, notes: true, isPrimary: true },
  });
  return { ok: true, properties };
}

/** Add a property. The customer's first property becomes the primary one. */
export async function addProperty(
  customerId: string,
  input: { label: string; address: string; notes?: string | null }
): Promise<PropertyResult> {
  const limited = checkLimit(await clientKey('props:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const customer = await ownedCustomer(businessId, customerId);
  if (!customer) return { ok: false, error: 'notFound' };

  const valid = validatePropertyFields(input);
  if ('error' in valid) return { ok: false, error: valid.error };

  try {
    const existing = await prisma.customerProperty.count({
      where: { customerId, businessId },
    });
    const property = await prisma.customerProperty.create({
      data: {
        customerId,
        businessId,
        label: valid.label,
        address: valid.address,
        notes: valid.notes,
        isPrimary: existing === 0,
      },
      select: { id: true, label: true, address: true, notes: true, isPrimary: true },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, property };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

/** Update a property's label/address/notes. Primary flag is set separately. */
export async function updateProperty(
  id: string,
  input: { label: string; address: string; notes?: string | null }
): Promise<PropertyResult> {
  const limited = checkLimit(await clientKey('props:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const existing = await ownedProperty(businessId, id);
  if (!existing) return { ok: false, error: 'notFound' };

  const valid = validatePropertyFields(input);
  if ('error' in valid) return { ok: false, error: valid.error };

  try {
    await prisma.customerProperty.update({
      where: { id },
      data: { label: valid.label, address: valid.address, notes: valid.notes },
    });
    revalidatePath(`/customers/${existing.customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

/** Delete a property. If it was primary, the oldest remaining becomes primary. */
export async function deleteProperty(id: string): Promise<PropertyResult> {
  const limited = checkLimit(await clientKey('props:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const existing = await ownedProperty(businessId, id);
  if (!existing) return { ok: false, error: 'notFound' };

  try {
    await prisma.$transaction(async (tx) => {
      const was = await tx.customerProperty.findUnique({
        where: { id },
        select: { isPrimary: true, customerId: true, createdAt: true },
      });
      await tx.customerProperty.delete({ where: { id } });
      if (was?.isPrimary) {
        const next = await tx.customerProperty.findFirst({
          where: { customerId: was.customerId, businessId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (next) {
          await tx.customerProperty.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });
    revalidatePath(`/customers/${existing.customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'deleteFailed' };
  }
}

/** Mark one property as the customer's primary (unsets the rest). */
export async function setPrimaryProperty(id: string): Promise<PropertyResult> {
  const limited = checkLimit(await clientKey('props:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const existing = await ownedProperty(businessId, id);
  if (!existing) return { ok: false, error: 'notFound' };

  try {
    await prisma.$transaction([
      prisma.customerProperty.updateMany({
        where: { customerId: existing.customerId, businessId },
        data: { isPrimary: false },
      }),
      prisma.customerProperty.update({
        where: { id },
        data: { isPrimary: true },
      }),
    ]);
    revalidatePath(`/customers/${existing.customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}
