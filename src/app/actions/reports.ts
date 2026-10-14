'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import type { ReportConfig } from '@/lib/reports';

const reportConfigSchema = z.object({
  type: z.enum(['revenue', 'expenses', 'jobs', 'quotes', 'invoices', 'customers']),
  dateRange: z.enum(['this_month', 'last_month', 'this_year', 'last_30', 'all']),
  groupBy: z.enum(['month', 'category', 'status', 'none']),
  metric: z.enum(['total', 'count', 'average']),
});

export type SaveReportResult = { ok?: boolean; id?: string; error?: string };

/** Save a built report for one-click re-runs (tenant-scoped). */
export async function saveReport(
  name: string,
  prompt: string,
  config: ReportConfig
): Promise<SaveReportResult> {
  const { businessId, user } = await requireAuth();
  const rl = rateLimit(`reports:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.rateLimited') };
  }

  const cleanName = name.trim().slice(0, 80);
  const cleanPrompt = prompt.trim().slice(0, 500);
  const parsed = reportConfigSchema.safeParse(config);
  const locale = await getLocale();
  if (!cleanName || !cleanPrompt || !parsed.success) {
    return { error: t(locale, 'reports.invalidReport') };
  }

  const saved = await prisma.savedReport.create({
    data: {
      businessId,
      name: cleanName,
      prompt: cleanPrompt,
      configJson: JSON.stringify(parsed.data),
    },
    select: { id: true },
  });

  revalidatePath('/reports');
  return { ok: true, id: saved.id };
}

export type DeleteReportResult = { ok?: boolean; error?: string };

/** Delete a saved report - tenant-scoped, only the owning business's row. */
export async function deleteReport(id: string): Promise<DeleteReportResult> {
  const { businessId, user } = await requireAuth();
  const rl = rateLimit(`reports:${user.id}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.rateLimited') };
  }

  await prisma.savedReport.deleteMany({ where: { id, businessId } });

  revalidatePath('/reports');
  return { ok: true };
}

export interface SavedReportRow {
  id: string;
  name: string;
  prompt: string;
  configJson: string;
  updatedAt: string;
}

/** List the business's saved reports (tenant-scoped). */
export async function listReports(): Promise<SavedReportRow[]> {
  const { businessId } = await requireAuth();
  const rows = await prisma.savedReport.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, name: true, prompt: true, configJson: true, updatedAt: true },
  });
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}
