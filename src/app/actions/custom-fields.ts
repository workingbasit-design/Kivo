'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type CustomFieldErrorCode =
  | 'tooMany'
  | 'login'
  | 'notFound'
  | 'invalidName'
  | 'nameTaken'
  | 'saveFailed'
  | 'deleteFailed';

export type CustomFieldDefRow = { id: string; name: string };
export type CustomFieldValueRow = { fieldId: string; value: string };

export type CustomFieldResult =
  | { ok: true; defs?: CustomFieldDefRow[]; values?: CustomFieldValueRow[] }
  | { ok: false; error: CustomFieldErrorCode };

const MAX_NAME = 40;
const MAX_VALUE = 500;

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function checkLimit(key: string): CustomFieldErrorCode | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  return rl.ok ? null : 'tooMany';
}

function validateName(raw: unknown): { name: string } | { error: CustomFieldErrorCode } {
  const name = String(raw ?? '').trim();
  if (!name || name.length > MAX_NAME) return { error: 'invalidName' };
  return { name };
}

/** All custom-field definitions for the business, plus one customer's values. */
export async function listFieldDefs(
  customerId: string
): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:list'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: 'notFound' };

  const [defs, values] = await Promise.all([
    prisma.customFieldDef.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.customerFieldValue.findMany({
      where: { customerId, field: { businessId } },
      select: { fieldId: true, value: true },
    }),
  ]);
  return { ok: true, defs, values };
}

/** Create a business-level custom field. Names are unique per business. */
export async function createFieldDef(rawName: string): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const valid = validateName(rawName);
  if ('error' in valid) return { ok: false, error: valid.error };

  const clash = await prisma.customFieldDef.findFirst({
    where: { businessId, name: valid.name },
    select: { id: true },
  });
  if (clash) return { ok: false, error: 'nameTaken' };

  try {
    await prisma.customFieldDef.create({
      data: { businessId, name: valid.name },
    });
    revalidatePath('/customers');
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

/** Rename a field definition owned by this business. */
export async function renameFieldDef(
  id: string,
  rawName: string
): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const def = await prisma.customFieldDef.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!def) return { ok: false, error: 'notFound' };

  const valid = validateName(rawName);
  if ('error' in valid) return { ok: false, error: valid.error };

  const clash = await prisma.customFieldDef.findFirst({
    where: { businessId, name: valid.name, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { ok: false, error: 'nameTaken' };

  try {
    await prisma.customFieldDef.update({
      where: { id },
      data: { name: valid.name },
    });
    revalidatePath('/customers');
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

/** Delete a field definition (its per-customer values cascade). */
export async function deleteFieldDef(id: string): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const def = await prisma.customFieldDef.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!def) return { ok: false, error: 'notFound' };

  try {
    await prisma.customFieldDef.delete({ where: { id } });
    revalidatePath('/customers');
    return { ok: true };
  } catch {
    return { ok: false, error: 'deleteFailed' };
  }
}

/**
 * Set one customer's value for a field. Both the field and the customer must
 * belong to this business. An empty value deletes the row (no blank rows).
 */
export async function setFieldValue(
  customerId: string,
  fieldId: string,
  rawValue: string
): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:write'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const [customer, def] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    }),
    prisma.customFieldDef.findFirst({
      where: { id: fieldId, businessId },
      select: { id: true },
    }),
  ]);
  if (!customer || !def) return { ok: false, error: 'notFound' };

  const value = String(rawValue ?? '').trim();
  if (value.length > MAX_VALUE) return { ok: false, error: 'saveFailed' };

  try {
    if (!value) {
      await prisma.customerFieldValue.deleteMany({
        where: { customerId, fieldId },
      });
    } else {
      await prisma.customerFieldValue.upsert({
        where: { fieldId_customerId: { fieldId, customerId } },
        create: { fieldId, customerId, value },
        update: { value },
      });
    }
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}
