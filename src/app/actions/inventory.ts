'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function checkLimit(userId: string): Promise<ActionResult | null> {
  const rl = rateLimit(`inventory:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return { ok: false, error: 'Too many requests. Please wait a moment and try again.' };
  }
  return null;
}

const partSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  sku: z.string().trim().max(50).optional(),
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative').default(0),
  reorderPoint: z.coerce.number().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  unit: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function toFormError(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Invalid input';
  return 'Something went wrong';
}

export async function createPart(formData: FormData): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  try {
    const parsed = partSchema.parse({
      name: formData.get('name'),
      sku: formData.get('sku') || undefined,
      quantity: formData.get('quantity') || 0,
      reorderPoint: formData.get('reorderPoint') || undefined,
      unitCost: formData.get('unitCost') || undefined,
      unit: formData.get('unit') || undefined,
      notes: formData.get('notes') || undefined,
    });
    const part = await prisma.part.create({
      data: {
        name: parsed.name,
        sku: parsed.sku || null,
        quantity: parsed.quantity,
        reorderPoint: parsed.reorderPoint ?? null,
        unitCost: parsed.unitCost ?? null,
        unit: parsed.unit || null,
        notes: parsed.notes || null,
        businessId,
      },
    });
    revalidatePath('/inventory');
    return { ok: true, id: part.id };
  } catch (e) {
    return { ok: false, error: toFormError(e) };
  }
}

export async function updatePart(id: string, formData: FormData): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  try {
    const existing = await prisma.part.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: 'Part not found' };

    const parsed = partSchema.parse({
      name: formData.get('name'),
      sku: formData.get('sku') || undefined,
      quantity: formData.get('quantity') || 0,
      reorderPoint: formData.get('reorderPoint') || undefined,
      unitCost: formData.get('unitCost') || undefined,
      unit: formData.get('unit') || undefined,
      notes: formData.get('notes') || undefined,
    });
    await prisma.part.update({
      where: { id, businessId },
      data: {
        name: parsed.name,
        sku: parsed.sku || null,
        quantity: parsed.quantity,
        reorderPoint: parsed.reorderPoint ?? null,
        unitCost: parsed.unitCost ?? null,
        unit: parsed.unit || null,
        notes: parsed.notes || null,
      },
    });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toFormError(e) };
  }
}

export async function adjustPartQuantity(id: string, delta: number): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  // Atomic: the "won't go below zero" guard lives in the WHERE clause, so
  // concurrent taps can't race a read-then-write into negative stock.
  // Single statement — safe under the one-connection pool constraint.
  const result = await prisma.part.updateMany({
    where: {
      id,
      businessId,
      quantity: { gte: -delta },
    },
    data: { quantity: { increment: delta } },
  });
  if (result.count === 0) {
    const exists = await prisma.part.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: 'Part not found' };
    return { ok: false, error: 'Quantity cannot go below zero' };
  }
  revalidatePath('/inventory');
  return { ok: true };
}

export async function deletePart(id: string): Promise<ActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const existing = await prisma.part.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: 'Part not found' };
  await prisma.part.delete({ where: { id, businessId } });
  revalidatePath('/inventory');
  return { ok: true };
}
