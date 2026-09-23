/**
 * Safe workflow engine — Track 8.
 *
 * Triggers (job completed, quote awaiting response, invoice overdue) are
 * evaluated on a schedule. Actions are DELIBERATELY limited to:
 *   1. in-app notifications, and
 *   2. draft creation (e.g. a review-request draft the owner can copy/send).
 *
 * There is NO external-send path here. Track 9's consented messaging system
 * remains the only way a message can leave the platform. Every firing is
 * idempotent (WorkflowEvent markers) and logged (AutomationLog).
 */

import { prisma } from '@/lib/prisma';

export const WORKFLOW_TRIGGERS = ['JOB_COMPLETED', 'QUOTE_AWAITING', 'INVOICE_OVERDUE'] as const;
export type WorkflowTrigger = (typeof WORKFLOW_TRIGGERS)[number];

export type WorkflowConfig = {
  /** QUOTE_AWAITING: days after SENT before firing (default 3). */
  followUpDays?: number;
  /** INVOICE_OVERDUE: days after invoice date before firing (default 14). */
  graceDays?: number;
  /** JOB_COMPLETED: also build a review-request draft (default true). */
  reviewDraft?: boolean;
};

export const DEFAULT_WORKFLOW_RULES: Array<{
  trigger: WorkflowTrigger;
  name: string;
  config: WorkflowConfig;
}> = [
  { trigger: 'JOB_COMPLETED', name: 'Job completed', config: { reviewDraft: true } },
  { trigger: 'QUOTE_AWAITING', name: 'Quote awaiting response', config: { followUpDays: 3 } },
  { trigger: 'INVOICE_OVERDUE', name: 'Invoice overdue', config: { graceDays: 14 } },
];

function parseConfig(raw: string | null): WorkflowConfig {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as WorkflowConfig;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Pure trigger evaluation (unit-testable, no DB).                      */
/* ------------------------------------------------------------------ */

export type JobCompletedCandidate = { id: string; updatedAt: Date };
export type QuoteAwaitingCandidate = { id: string; updatedAt: Date };
export type InvoiceOverdueCandidate = { id: string; date: Date; status: string };

/**
 * Jobs that completed recently. Completion is signalled by updatedAt while
 * in COMPLETED status (there is no separate completedAt column); the window
 * defaults to 48h so a daily cron can't miss a completion, and
 * WorkflowEvent markers guarantee each job fires at most once ever.
 */
export function jobsCompletedDue(
  jobs: JobCompletedCandidate[],
  now: Date,
  windowHours = 48
): string[] {
  const cutoff = now.getTime() - windowHours * 3600 * 1000;
  return jobs.filter((j) => j.updatedAt.getTime() >= cutoff).map((j) => j.id);
}

/** SENT quotes idle longer than followUpDays. */
export function quotesAwaitingDue(
  quotes: QuoteAwaitingCandidate[],
  now: Date,
  followUpDays: number
): string[] {
  const cutoff = now.getTime() - followUpDays * 24 * 3600 * 1000;
  return quotes.filter((q) => q.updatedAt.getTime() <= cutoff).map((q) => q.id);
}

/** Unpaid invoices older than graceDays past their invoice date. */
export function invoicesOverdueDue(
  invoices: InvoiceOverdueCandidate[],
  now: Date,
  graceDays: number
): string[] {
  const cutoff = now.getTime() - graceDays * 24 * 3600 * 1000;
  return invoices
    .filter((i) => ['UNPAID', 'PARTIALLY PAID'].includes(i.status) && i.date.getTime() <= cutoff)
    .map((i) => i.id);
}

/* ------------------------------------------------------------------ */
/* Rule management                                                     */
/* ------------------------------------------------------------------ */

export async function getOrCreateDefaultRules(businessId: string) {
  const existing = await prisma.workflowRule.findMany({ where: { businessId } });
  if (existing.length > 0) return existing;
  await prisma.workflowRule.createMany({
    data: DEFAULT_WORKFLOW_RULES.map((r) => ({
      businessId,
      name: r.name,
      trigger: r.trigger,
      enabled: true,
      configJson: JSON.stringify(r.config),
    })),
  });
  return prisma.workflowRule.findMany({ where: { businessId } });
}

/* ------------------------------------------------------------------ */
/* Engine run                                                          */
/* ------------------------------------------------------------------ */

export type WorkflowRunResult = {
  rulesEvaluated: number;
  fired: number;
  details: Array<{ ruleId: string; trigger: string; fired: number }>;
};

function reviewDraftMessages(customerName: string, jobTitle: string): { en: string; fr: string } {
  return {
    en: `Hi ${customerName}! Thanks for choosing us for "${jobTitle}". If you were happy with the work, a Google review would mean a lot — reply YES and I'll send you the link.`,
    fr: `Bonjour ${customerName}! Merci de nous avoir choisis pour « ${jobTitle} ». Si vous êtes satisfait du travail, un avis Google nous aiderait beaucoup — répondez OUI et je vous enverrai le lien.`,
  };
}

/**
 * Evaluate every enabled rule for a business and fire due actions.
 * Idempotent: a WorkflowEvent row is created first inside a transaction —
 * a unique-violation means another run already fired for that entity, so it
 * is skipped. Notifications are in-app only; review content is a DRAFT the
 * owner copies — nothing is ever sent automatically.
 */
export async function runWorkflowsForBusiness(businessId: string): Promise<WorkflowRunResult> {
  const rules = await getOrCreateDefaultRules(businessId);
  const now = new Date();
  const result: WorkflowRunResult = { rulesEvaluated: 0, fired: 0, details: [] };

  // Entities already fired for each rule (idempotency).
  const firedKeys = new Set(
    (
      await prisma.workflowEvent.findMany({
        where: { rule: { businessId } },
        select: { ruleId: true, entityType: true, entityId: true },
      })
    ).map((e) => `${e.ruleId}:${e.entityType}:${e.entityId}`)
  );

  for (const rule of rules) {
    if (!rule.enabled) continue;
    result.rulesEvaluated++;
    const config = parseConfig(rule.configJson);
    let fired = 0;

    if (rule.trigger === 'JOB_COMPLETED') {
      const jobs = await prisma.job.findMany({
        where: { businessId, status: 'COMPLETED' },
        select: { id: true, title: true, updatedAt: true, customer: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      const dueIds = jobsCompletedDue(jobs, now).filter(
        (id) => !firedKeys.has(`${rule.id}:JOB:${id}`)
      );
      for (const job of jobs.filter((j) => dueIds.includes(j.id))) {
        const draft = reviewDraftMessages(job.customer.name, job.title);
        const data = JSON.stringify({
          jobTitle: job.title,
          customerName: job.customer.name,
          draftEn: config.reviewDraft === false ? '' : draft.en,
          draftFr: config.reviewDraft === false ? '' : draft.fr,
        });
        if (await fireOnce(rule.id, 'JOB', job.id, businessId, 'review_request_draft', data, `/jobs/${job.id}`)) {
          fired++;
          firedKeys.add(`${rule.id}:JOB:${job.id}`);
        }
      }
    } else if (rule.trigger === 'QUOTE_AWAITING') {
      const followUpDays = Math.max(1, Math.min(90, config.followUpDays ?? 3));
      const quotes = await prisma.quote.findMany({
        where: { businessId, status: 'SENT' },
        select: { id: true, number: true, title: true, total: true, updatedAt: true, customer: { select: { name: true } } },
        orderBy: { updatedAt: 'asc' },
        take: 100,
      });
      const dueIds = quotesAwaitingDue(quotes, now, followUpDays).filter(
        (id) => !firedKeys.has(`${rule.id}:QUOTE:${id}`)
      );
      for (const q of quotes.filter((x) => dueIds.includes(x.id))) {
        const data = JSON.stringify({
          number: q.number,
          title: q.title,
          customerName: q.customer.name,
          total: q.total.toFixed(2),
        });
        if (await fireOnce(rule.id, 'QUOTE', q.id, businessId, 'workflow_quote_followup', data, `/quotes/${q.id}`)) {
          fired++;
          firedKeys.add(`${rule.id}:QUOTE:${q.id}`);
        }
      }
    } else if (rule.trigger === 'INVOICE_OVERDUE') {
      const graceDays = Math.max(1, Math.min(365, config.graceDays ?? 14));
      const invoices = await prisma.invoice.findMany({
        where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
        select: { id: true, number: true, total: true, date: true, status: true, customer: { select: { name: true } } },
        orderBy: { date: 'asc' },
        take: 100,
      });
      const dueIds = invoicesOverdueDue(invoices, now, graceDays).filter(
        (id) => !firedKeys.has(`${rule.id}:INVOICE:${id}`)
      );
      for (const inv of invoices.filter((x) => dueIds.includes(x.id))) {
        const data = JSON.stringify({
          number: inv.number,
          customerName: inv.customer.name,
          total: inv.total.toFixed(2),
        });
        if (await fireOnce(rule.id, 'INVOICE', inv.id, businessId, 'workflow_invoice_overdue', data, `/invoices/${inv.id}`)) {
          fired++;
          firedKeys.add(`${rule.id}:INVOICE:${inv.id}`);
        }
      }
    }

    result.fired += fired;
    result.details.push({ ruleId: rule.id, trigger: rule.trigger, fired });
  }

  if (result.fired > 0 || result.rulesEvaluated > 0) {
    await prisma.automationLog.create({
      data: {
        businessId,
        kind: 'WORKFLOW',
        summary: `Workflow run: ${result.fired} action${result.fired === 1 ? '' : 's'} fired across ${result.rulesEvaluated} enabled rule${result.rulesEvaluated === 1 ? '' : 's'}.`,
        metaJson: JSON.stringify(result.details),
      },
    });
  }
  return result;
}

/**
 * Fire a single workflow action idempotently. Returns true when this run
 * actually fired (false when another run already did).
 */
async function fireOnce(
  ruleId: string,
  entityType: 'JOB' | 'QUOTE' | 'INVOICE',
  entityId: string,
  businessId: string,
  notificationType: string,
  data: string,
  href: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // Idempotency marker first: a unique violation aborts the transaction.
      await tx.workflowEvent.create({
        data: { ruleId, entityType, entityId },
      });
      // In-app notification only — never an external send.
      await tx.notification.create({
        data: {
          businessId,
          type: notificationType,
          data,
          href,
          dedupeKey: `workflow:${ruleId}:${entityType}:${entityId}`,
        },
      });
    });
    return true;
  } catch {
    // Unique violation (or anything else): treat as already-fired / skipped.
    return false;
  }
}
