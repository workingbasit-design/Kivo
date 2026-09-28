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

const equipmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  serial: z.string().trim().max(100).optional(),
  installDate: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  customerId: z.string().min(1),
});

function toFormError(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Invalid input';
  return 'Something went wrong';
}

async function assertCustomer(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
  return customer;
}

export async function createEquipment(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireAuth();
  try {
    const parsed = equipmentSchema.parse({
      name: formData.get('name'),
      brand: formData.get('brand') || undefined,
      model: formData.get('model') || undefined,
      serial: formData.get('serial') || undefined,
      installDate: formData.get('installDate') || undefined,
      notes: formData.get('notes') || undefined,
      customerId: formData.get('customerId'),
    });
    if (!(await assertCustomer(businessId, parsed.customerId))) {
      return { ok: false, error: 'Customer not found' };
    }
    const eq = await prisma.equipment.create({
      data: {
        name: parsed.name,
        brand: parsed.brand || null,
        model: parsed.model || null,
        serial: parsed.serial || null,
        installDate: parsed.installDate ? new Date(parsed.installDate) : null,
        notes: parsed.notes || null,
        customerId: parsed.customerId,
        businessId,
      },
    });
    revalidatePath('/equipment');
    revalidatePath(`/customers/${parsed.customerId}`);
    return { ok: true, id: eq.id };
  } catch (e) {
    return { ok: false, error: toFormError(e) };
  }
}

export async function updateEquipment(id: string, formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireAuth();
  try {
    const existing = await prisma.equipment.findFirst({
      where: { id, businessId },
      select: { id: true, customerId: true },
    });
    if (!existing) return { ok: false, error: 'Equipment not found' };

    const parsed = equipmentSchema.parse({
      name: formData.get('name'),
      brand: formData.get('brand') || undefined,
      model: formData.get('model') || undefined,
      serial: formData.get('serial') || undefined,
      installDate: formData.get('installDate') || undefined,
      notes: formData.get('notes') || undefined,
      customerId: existing.customerId,
    });
    await prisma.equipment.update({
      where: { id },
      data: {
        name: parsed.name,
        brand: parsed.brand || null,
        model: parsed.model || null,
        serial: parsed.serial || null,
        installDate: parsed.installDate ? new Date(parsed.installDate) : null,
        notes: parsed.notes || null,
      },
    });
    revalidatePath('/equipment');
    revalidatePath(`/customers/${existing.customerId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toFormError(e) };
  }
}

export async function deleteEquipment(id: string): Promise<ActionResult> {
  const { businessId } = await requireAuth();
  const existing = await prisma.equipment.findFirst({
    where: { id, businessId },
    select: { id: true, customerId: true },
  });
  if (!existing) return { ok: false, error: 'Equipment not found' };
  await prisma.equipment.delete({ where: { id } });
  revalidatePath('/equipment');
  revalidatePath(`/customers/${existing.customerId}`);
  return { ok: true };
}
