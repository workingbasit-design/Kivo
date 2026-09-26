'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serviceSchema } from '@/lib/validations';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type ServiceResult = { error?: string; ok?: boolean };

/**
 * Extended service fields: duration (minutes, 5–1440, optional) and
 * description (optional plain-text). Blank inputs stay null.
 */
const serviceFieldsSchema = serviceSchema.extend({
  durationMin: z.preprocess(
    (v) => (String(v ?? '').trim() === '' ? undefined : v),
    z.coerce
      .number()
      .int('Duration must be a whole number of minutes.')
      .min(5, 'Duration must be between 5 and 1440 minutes.')
      .max(1440, 'Duration must be between 5 and 1440 minutes.')
      .optional()
  ),
  description: z.string().trim().max(500, 'Description is too long.').optional().default(''),
});

type ServiceFields = z.infer<typeof serviceFieldsSchema>;

function nullIfBlank(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

function limited(businessId: string): ServiceResult | null {
  const rl = rateLimit(`services:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

async function parse(data: unknown): Promise<{ data?: ServiceFields; error?: string }> {
  const parsed = serviceFieldsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid service details.' };
  }
  return { data: parsed.data };
}

/** Create a price-book service. Called directly from PriceBookClient. */
export async function createService(formData: FormData): Promise<ServiceResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const { data, error } = await parse({
    name: formData.get('name'),
    price: formData.get('price'),
    durationMin: formData.get('durationMin'),
    description: formData.get('description'),
  });
  if (error || !data) return { error: error ?? 'Invalid service details.' };

  // Avoid confusing duplicates: names are unique per business (case-insensitive).
  // (SQLite/Prisma 5 has no case-insensitive StringFilter, so compare in JS.)
  const existing = await prisma.service.findMany({
    where: { businessId },
    select: { name: true },
  });
  const wanted = data.name.trim().toLowerCase();
  if (existing.some((s) => s.name.trim().toLowerCase() === wanted)) {
    return { error: `"${data.name.trim()}" is already in your price book.` };
  }

  await prisma.service.create({
    data: {
      name: data.name,
      price: data.price,
      durationMin: data.durationMin ?? null,
      description: nullIfBlank(data.description),
      businessId,
    },
  });
  revalidatePath('/pricebook');
  return { ok: true };
}

/** Update a price-book service. */
export async function updateService(id: string, formData: FormData): Promise<ServiceResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) return { error: 'Service not found.' };

  const { data, error } = await parse({
    name: formData.get('name'),
    price: formData.get('price'),
    durationMin: formData.get('durationMin'),
    description: formData.get('description'),
  });
  if (error || !data) return { error: error ?? 'Invalid service details.' };

  await prisma.service.update({
    where: { id, businessId },
    data: {
      name: data.name,
      price: data.price,
      durationMin: data.durationMin ?? null,
      description: nullIfBlank(data.description),
    },
  });
  revalidatePath('/pricebook');
  return { ok: true };
}

/** Delete a price-book service. */
export async function deleteService(id: string): Promise<ServiceResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) return { error: 'Service not found.' };

  await prisma.service.delete({ where: { id, businessId } });
  revalidatePath('/pricebook');
  return { ok: true };
}

const DEFAULT_SERVICES = [
  { name: 'Split AC Jet Wash', price: 1500 },
  { name: 'AC Gas Refill', price: 2500 },
  { name: 'Electrical Wiring Repair', price: 800 },
  { name: 'Plumbing Leak Fix', price: 600 },
  { name: 'Pest Control (1BHK)', price: 1200 },
  { name: 'Appliance Service Visit', price: 500 },
];

/** Seed 6 standard services. Only runs when the price book is empty. */
export async function seedDefaultServices(): Promise<ServiceResult> {
  const { businessId } = await requireAuth();
  const hit = limited(businessId);
  if (hit) return hit;

  const count = await prisma.service.count({ where: { businessId } });
  if (count > 0) return { error: 'Price book already has services.' };

  await prisma.service.createMany({
    data: DEFAULT_SERVICES.map((s) => ({ ...s, businessId })),
  });
  revalidatePath('/pricebook');
  return { ok: true };
}
