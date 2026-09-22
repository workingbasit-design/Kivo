'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serviceSchema } from '@/lib/validations';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type ServiceResult = { error?: string; ok?: boolean };

function limited(businessId: string): ServiceResult | null {
  const rl = rateLimit(`services:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

async function parse(data: unknown): Promise<{ data?: z.infer<typeof serviceSchema>; error?: string }> {
  const parsed = serviceSchema.safeParse(data);
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
    data: { name: data.name, price: data.price, businessId },
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
  });
  if (error || !data) return { error: error ?? 'Invalid service details.' };

  await prisma.service.update({
    where: { id },
    data: { name: data.name, price: data.price },
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

  await prisma.service.delete({ where: { id } });
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
