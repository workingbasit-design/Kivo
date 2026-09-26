'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import {
  WORKFLOW_TRIGGERS,
  getOrCreateDefaultRules,
  type WorkflowTrigger,
} from '@/lib/workflows';

export type AutomationActionResult = {
  ok?: boolean;
  error?: string;
  fired?: number;
  rulesEvaluated?: number;
};

async function checkLimit(userId: string) {
  const rl = rateLimit(`automations:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.rateLimited') };
  }
  return null;
}

/** Toggle a workflow rule on/off (tenant-scoped). */
export async function setWorkflowRuleEnabled(
  ruleId: string,
  enabled: boolean
): Promise<AutomationActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const rule = await prisma.workflowRule.findFirst({ where: { id: ruleId, businessId } });
  if (!rule) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.ruleNotFound') };
  }
  await prisma.workflowRule.update({ where: { id: rule.id, businessId }, data: { enabled } });
  revalidatePath('/settings/automations');
  return { ok: true };
}

/** Update a rule's config (follow-up days / grace days / review draft). */
export async function updateWorkflowRuleConfig(
  ruleId: string,
  config: { followUpDays?: number; graceDays?: number; reviewDraft?: boolean }
): Promise<AutomationActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const rule = await prisma.workflowRule.findFirst({ where: { id: ruleId, businessId } });
  if (!rule) return { error: t(locale, 'track8.ruleNotFound') };

  const clean: Record<string, number | boolean> = {};
  if (rule.trigger === 'QUOTE_AWAITING' && typeof config.followUpDays === 'number') {
    clean.followUpDays = Math.max(1, Math.min(90, Math.round(config.followUpDays)));
  }
  if (rule.trigger === 'INVOICE_OVERDUE' && typeof config.graceDays === 'number') {
    clean.graceDays = Math.max(1, Math.min(365, Math.round(config.graceDays)));
  }
  if (rule.trigger === 'JOB_COMPLETED' && typeof config.reviewDraft === 'boolean') {
    clean.reviewDraft = config.reviewDraft;
  }
  await prisma.workflowRule.update({
    where: { id: rule.id, businessId },
    data: { configJson: JSON.stringify(clean) },
  });
  revalidatePath('/settings/automations');
  return { ok: true };
}

/** Manual "run now" for the owner — same idempotent engine the cron uses. */
export async function runWorkflowsNow(): Promise<AutomationActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const { runWorkflowsForBusiness } = await import('@/lib/workflows');
  const r = await runWorkflowsForBusiness(businessId);
  revalidatePath('/settings/automations');
  return { ok: true, fired: r.fired, rulesEvaluated: r.rulesEvaluated };
}

export async function getAutomationState() {
  const { businessId } = await requireAuth();
  const rules = await getOrCreateDefaultRules(businessId);
  const logs = await prisma.automationLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return {
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      trigger: r.trigger as WorkflowTrigger,
      enabled: r.enabled,
      configJson: r.configJson,
    })),
    logs: logs.map((l) => ({
      id: l.id,
      kind: l.kind,
      summary: l.summary,
      createdAt: l.createdAt.toISOString(),
    })),
    triggers: [...WORKFLOW_TRIGGERS],
  };
}
