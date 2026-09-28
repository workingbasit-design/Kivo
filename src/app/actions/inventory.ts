'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
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
  const { businessId } = await requireAuth();
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
  const { businessId } = await requireAuth();
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
      where: { id },
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
  const { businessId } = await requireAuth();
  const existing = await prisma.part.findFirst({
    where: { id, businessId },
    select: { id: true, quantity: true },
  });
  if (!existing) return { ok: false, error: 'Part not found' };

  const newQty = existing.quantity + delta;
  if (newQty < 0) return { ok: false, error: 'Quantity cannot go below zero' };

  await prisma.part.update({
    where: { id },
    data: { quantity: newQty },
  });
  revalidatePath('/inventory');
  return { ok: true };
}

export async function deletePart(id: string): Promise<ActionResult> {
  const { businessId } = await requireAuth();
  const existing = await prisma.part.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: 'Part not found' };
  await prisma.part.delete({ where: { id } });
  revalidatePath('/inventory');
  return { ok: true };
}
