'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { customerSchema } from '@/lib/validations';
import { validatePhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import { validatePostalCode, INVALID_POSTAL_MESSAGE } from '@/lib/postal';
import { tagsToDb } from '@/lib/tags';

export type ActionResult = { error?: string; ok?: boolean };

/** Region code of the current business (drives phone validation). Always CA. */
async function businessRegion(_businessId: string): Promise<string> {
  return 'CA';
}

/** Validate an optional phone; returns the E.164 digit form or an error. */
function checkPhone(
  phone: string,
  region: string
): { digits: string | null } | { error: string } {
  const result = validatePhone(phone, region);
  if (!result.ok) return { error: INVALID_PHONE_MESSAGE };
  return { digits: result.digits };
}

/** Validate an optional postal code; returns the canonical form or an error. */
function checkPostalCode(
  postalCode: string,
  region: string
): { formatted: string | null } | { error: string } {
  const result = validatePostalCode(postalCode, region);
  if (!result.ok) {
    return { error: INVALID_POSTAL_MESSAGE };
  }
  return { formatted: result.formatted };
}

function parseCustomerForm(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    address: formData.get('address'),
    province: formData.get('province'),
    postalCode: formData.get('postalCode'),
    notes: formData.get('notes'),
    tags: formData.get('tags'),
  });
}

async function checkLimit(userId: string): Promise<ActionResult | null> {
  const rl = rateLimit(`customer:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

function nullIfEmpty(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

/** Create a customer for the current business. */
export async function createCustomer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }
  const { name, phone, email, address, province, postalCode, notes, tags } = parsed.data;

  const region = await businessRegion(businessId);
  const phoneCheck = checkPhone(phone, region);
  if ('error' in phoneCheck) return { error: phoneCheck.error };
  const postalCheck = checkPostalCode(postalCode, region);
  if ('error' in postalCheck) return { error: postalCheck.error };

  await prisma.customer.create({
    data: {
      name,
      phone: nullIfEmpty(phone),
      phoneNorm: phoneCheck.digits,
      email: nullIfEmpty(email),
      address: nullIfEmpty(address),
      province: nullIfEmpty(province)?.toUpperCase() ?? null,
      postalCode: postalCheck.formatted,
      notes: nullIfEmpty(notes),
      tags: tagsToDb(tags),
      businessId,
    },
  });

  revalidatePath('/customers');
  redirect('/customers');
}

/** Update a customer (must belong to the current business). */
export async function updateCustomer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const id = String(formData.get('id') ?? '');

  const existing = await prisma.customer.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { error: 'Customer not found.' };

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }
  const { name, phone, email, address, province, postalCode, notes, tags } = parsed.data;

  const region = await businessRegion(businessId);
  const phoneCheck = checkPhone(phone, region);
  if ('error' in phoneCheck) return { error: phoneCheck.error };
  const postalCheck = checkPostalCode(postalCode, region);
  if ('error' in postalCheck) return { error: postalCheck.error };

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      phone: nullIfEmpty(phone),
      phoneNorm: phoneCheck.digits,
      email: nullIfEmpty(email),
      address: nullIfEmpty(address),
      province: nullIfEmpty(province)?.toUpperCase() ?? null,
      postalCode: postalCheck.formatted,
      notes: nullIfEmpty(notes),
      tags: tagsToDb(tags),
    },
  });

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

/** Delete a customer (must belong to the current business). */
export async function deleteCustomer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const id = String(formData.get('id') ?? '');

  const existing = await prisma.customer.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { error: 'Customer not found.' };

  // Related jobs, invoices, quotes cascade; reviews are set null.
  await prisma.customer.delete({ where: { id } });

  revalidatePath('/customers');
  redirect('/customers');
}

/**
 * Convert a lead into a customer, marking the lead CONVERTED.
 * Idempotent: an already-converted lead is not converted again.
 * De-duplicates by normalized phone: if a customer with the lead's phoneNorm
 * already exists, the lead is linked to that customer instead of creating a
 * second customer record.
 * Creates the customer, then redirects to the new customer page.
 */
export async function convertLeadToCustomer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const leadId = String(formData.get('leadId') ?? '');

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId },
  });
  if (!lead) return { error: 'Lead not found.' };
  if (lead.status === 'CONVERTED') {
    return { error: 'This lead has already been converted.' };
  }

  const existingCustomer = lead.phoneNorm
    ? await prisma.customer.findFirst({
        where: { businessId, phoneNorm: lead.phoneNorm },
        select: { id: true },
      })
    : null;

  const customer = existingCustomer
    ? existingCustomer
    : await prisma.customer.create({
        data: {
          name: lead.name,
          phone: lead.phone,
          phoneNorm: lead.phoneNorm,
          email: lead.email,
          address: null,
          notes: lead.details ? `From lead (${lead.source ?? 'unknown source'}): ${lead.details}` : null,
          businessId,
        },
        select: { id: true },
      });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'CONVERTED' },
  });

  revalidatePath('/leads');
  revalidatePath('/customers');
  redirect(`/customers/${customer.id}`);
}
