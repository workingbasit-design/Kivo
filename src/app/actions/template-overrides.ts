'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { TEMPLATE_IDS, type MessageTemplateId, type MsgLocale } from '@/lib/messaging/templates';

type Result = { error?: string; success?: boolean };

/**
 * F5: Get all template overrides for the business, keyed by templateId+locale.
 */
export async function getTemplateOverrides(): Promise<
  Record<string, { subject: string; body: string }>
> {
  const session = await requireAuth();
  const businessId = session.businessId;
  if (!businessId) return {};

  const overrides = await prisma.messageTemplateOverride.findMany({
    where: { businessId },
    select: { templateId: true, locale: true, subject: true, body: true },
  });

  const map: Record<string, { subject: string; body: string }> = {};
  for (const o of overrides) {
    map[`${o.templateId}:${o.locale}`] = { subject: o.subject, body: o.body };
  }
  return map;
}

/**
 * F5: Save a custom template override (or delete to revert to built-in).
 * Validates templateId and locale. Body must include opt-out footer
 * (checked loosely — must contain "STOP" or "ARRÊT").
 */
export async function saveTemplateOverride(
  templateId: string,
  locale: string,
  subject: string,
  body: string
): Promise<Result> {
  const session = await requireAuth();
  const businessId = session.businessId;
  if (!businessId) return { error: 'No business.' };

  if (!(TEMPLATE_IDS as string[]).includes(templateId)) {
    return { error: 'Invalid template.' };
  }
  if (locale !== 'en' && locale !== 'fr') {
    return { error: 'Invalid locale.' };
  }
  if (!subject.trim() || !body.trim()) {
    return { error: 'Subject and body are required.' };
  }
  if (body.length > 2000) {
    return { error: 'Body too long (max 2000 chars).' };
  }
  // CASL: require opt-out footer
  const upper = body.toUpperCase();
  if (!upper.includes('STOP') && !upper.includes('ARRÊT') && !upper.includes('ARRET')) {
    return { error: 'Body must include opt-out (Reply STOP / Répondez ARRÊT).' };
  }

  await prisma.messageTemplateOverride.upsert({
    where: {
      businessId_templateId_locale: { businessId, templateId, locale },
    },
    update: { subject: subject.trim(), body: body.trim() },
    create: {
      businessId,
      templateId,
      locale,
      subject: subject.trim(),
      body: body.trim(),
    },
  });

  revalidatePath('/settings/messaging');
  return { success: true };
}

/**
 * F5: Delete an override, reverting to the built-in template.
 */
export async function deleteTemplateOverride(
  templateId: string,
  locale: string
): Promise<Result> {
  const session = await requireAuth();
  const businessId = session.businessId;
  if (!businessId) return { error: 'No business.' };

  await prisma.messageTemplateOverride.deleteMany({
    where: { businessId, templateId, locale },
  });

  revalidatePath('/settings/messaging');
  return { success: true };
}
