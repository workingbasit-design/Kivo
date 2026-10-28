'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { clientIpFromHeaders } from '@/lib/client-ip';

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

/** Slice 6: def targets. CUSTOMER is the original (default). */
export const CUSTOM_FIELD_TARGETS = ['CUSTOMER', 'PROPERTY', 'JOB'] as const;
export type CustomFieldTarget = (typeof CUSTOM_FIELD_TARGETS)[number];

function validateTarget(raw: unknown): CustomFieldTarget {
  const t = String(raw ?? 'CUSTOMER').toUpperCase();
  return (CUSTOM_FIELD_TARGETS as readonly string[]).includes(t)
    ? (t as CustomFieldTarget)
    : 'CUSTOMER';
}

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
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

/** All custom-field definitions for the business (one target), plus one customer's values. */
export async function listFieldDefs(
  customerId: string,
  target: CustomFieldTarget = 'CUSTOMER'
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
      where: { businessId, target: validateTarget(target) },
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

/** Create a business-level custom field. Names are unique per business per target. */
export async function createFieldDef(
  rawName: string,
  rawTarget: unknown = 'CUSTOMER'
): Promise<CustomFieldResult> {
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
  const target = validateTarget(rawTarget);

  const clash = await prisma.customFieldDef.findFirst({
    where: { businessId, target, name: valid.name },
    select: { id: true },
  });
  if (clash) return { ok: false, error: 'nameTaken' };

  try {
    await prisma.customFieldDef.create({
      data: { businessId, target, name: valid.name },
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
    select: { id: true, target: true },
  });
  if (!def) return { ok: false, error: 'notFound' };

  const valid = validateName(rawName);
  if ('error' in valid) return { ok: false, error: valid.error };

  // Rename clashes only within the def's own target (same name on
  // another target is legitimate, cf. slice 6).
  const clash = await prisma.customFieldDef.findFirst({
    where: { businessId, target: def.target, name: valid.name, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { ok: false, error: 'nameTaken' };

  try {
    await prisma.customFieldDef.update({
      where: { id, businessId },
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
    await prisma.customFieldDef.delete({ where: { id, businessId } });
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

/** Slice 6: PROPERTY defs + one property's values (mirror of listFieldDefs). */
export async function listPropertyFieldDefs(
  propertyId: string
): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:list'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const property = await prisma.customerProperty.findFirst({
    where: { id: propertyId, businessId },
    select: { id: true },
  });
  if (!property) return { ok: false, error: 'notFound' };

  const [defs, values] = await Promise.all([
    prisma.customFieldDef.findMany({
      where: { businessId, target: 'PROPERTY' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.propertyFieldValue.findMany({
      where: { propertyId, field: { businessId } },
      select: { fieldId: true, value: true },
    }),
  ]);
  return { ok: true, defs, values };
}

/**
 * Slice 6: set one property's value for a PROPERTY field. Both the
 * field and the property must belong to this business. Empty clears.
 */
export async function setPropertyFieldValue(
  propertyId: string,
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

  const [property, def] = await Promise.all([
    prisma.customerProperty.findFirst({
      where: { id: propertyId, businessId },
      select: { id: true, customerId: true },
    }),
    prisma.customFieldDef.findFirst({
      where: { id: fieldId, businessId, target: 'PROPERTY' },
      select: { id: true },
    }),
  ]);
  if (!property || !def) return { ok: false, error: 'notFound' };

  const value = String(rawValue ?? '').trim();
  if (value.length > MAX_VALUE) return { ok: false, error: 'saveFailed' };

  try {
    if (!value) {
      await prisma.propertyFieldValue.deleteMany({
        where: { propertyId, fieldId },
      });
    } else {
      await prisma.propertyFieldValue.upsert({
        where: { fieldId_propertyId: { fieldId, propertyId } },
        create: { fieldId, propertyId, value },
        update: { value },
      });
    }
    revalidatePath(`/customers/${property.customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}

/** Slice 6: JOB defs + one job's values (mirror of listFieldDefs). */
export async function listJobFieldDefs(
  jobId: string
): Promise<CustomFieldResult> {
  const limited = checkLimit(await clientKey('cfields:list'));
  if (limited) return { ok: false, error: limited };

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { ok: false, error: 'login' };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true },
  });
  if (!job) return { ok: false, error: 'notFound' };

  const [defs, values] = await Promise.all([
    prisma.customFieldDef.findMany({
      where: { businessId, target: 'JOB' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.jobFieldValue.findMany({
      where: { jobId, field: { businessId } },
      select: { fieldId: true, value: true },
    }),
  ]);
  return { ok: true, defs, values };
}

/**
 * Slice 6: set one job's value for a JOB field. Both the field and the
 * job must belong to this business. Empty clears.
 */
export async function setJobFieldValue(
  jobId: string,
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

  const [job, def] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, businessId },
      select: { id: true },
    }),
    prisma.customFieldDef.findFirst({
      where: { id: fieldId, businessId, target: 'JOB' },
      select: { id: true },
    }),
  ]);
  if (!job || !def) return { ok: false, error: 'notFound' };

  const value = String(rawValue ?? '').trim();
  if (value.length > MAX_VALUE) return { ok: false, error: 'saveFailed' };

  try {
    if (!value) {
      await prisma.jobFieldValue.deleteMany({
        where: { jobId, fieldId },
      });
    } else {
      await prisma.jobFieldValue.upsert({
        where: { fieldId_jobId: { fieldId, jobId } },
        create: { fieldId, jobId, value },
        update: { value },
      });
    }
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath('/jobs');
    return { ok: true };
  } catch {
    return { ok: false, error: 'saveFailed' };
  }
}
