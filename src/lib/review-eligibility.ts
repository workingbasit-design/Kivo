/**
 * Review eligibility (the review moat, core rule).
 *
 * A review may only be tied to a REAL, COMPLETED job for which the customer
 * has a PAID invoice. Both conditions are verified server-side before a
 * review-request link is generated and before an owner-recorded review is
 * saved.
 *
 * SAFER OPTION CHOSEN (documented): the paid-invoice check is per
 * customer+ business, not per job via invoice.jobId. Reason: the manual
 * invoice-creation flow never sets invoice.jobId (only batch invoicing
 * does), so requiring invoice.jobId would silently block almost every real
 * job. A customer with a paid invoice is provably a real paying customer;
 * that is what the moat needs to stop drive-by fake reviews. If per-job
 * invoice linkage is ever required, tighten `hasPaidInvoice` here — every
 * caller goes through checkReviewEligibility.
 */
import { prisma } from '@/lib/prisma';

/** Job statuses that count as "completed" for review purposes. */
export const REVIEW_ELIGIBLE_JOB_STATUSES: ReadonlySet<string> = new Set([
  'COMPLETED',
  'PAID',
]);

export type EligibilityFailureReason =
  | 'job-not-found'
  | 'job-not-complete'
  | 'no-paid-invoice';

export type EligibilityResult =
  | { ok: true }
  | { ok: false; reason: EligibilityFailureReason };

/**
 * Pure rule check — no I/O, fully unit-testable.
 * `job` is null when the job doesn't exist / doesn't belong to the business.
 */
export function checkReviewEligibility(
  job: { status: string } | null,
  hasPaidInvoice: boolean
): EligibilityResult {
  if (!job) return { ok: false, reason: 'job-not-found' };
  if (!REVIEW_ELIGIBLE_JOB_STATUSES.has(job.status))
    return { ok: false, reason: 'job-not-complete' };
  if (!hasPaidInvoice) return { ok: false, reason: 'no-paid-invoice' };
  return { ok: true };
}

export type EligibleJob = {
  id: string;
  title: string;
  date: Date;
  customerId: string;
  customer: { name: string; phone: string | null };
};

/**
 * Server-side eligibility for one job. Returns the job (with customer)
 * when eligible — callers use it to build the review/request.
 */
export async function getReviewEligibility(
  businessId: string,
  jobId: string
): Promise<
  | { ok: true; job: EligibleJob }
  | { ok: false; reason: EligibilityFailureReason }
> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      customerId: true,
      customer: { select: { name: true, phone: true } },
    },
  });
  if (!job) return { ok: false, reason: 'job-not-found' };

  const paidInvoice = await prisma.invoice.findFirst({
    where: { businessId, customerId: job.customerId, status: 'PAID' },
    select: { id: true },
  });

  const check = checkReviewEligibility(job, !!paidInvoice);
  if (!check.ok) return check;
  const { status: _status, ...eligible } = job;
  return { ok: true, job: eligible };
}

/**
 * All jobs of a business that can currently receive reviews,
 * newest first. Optionally restricted to recent jobs.
 */
export async function listEligibleReviewJobs(
  businessId: string,
  since?: Date
): Promise<EligibleJob[]> {
  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      status: { in: [...REVIEW_ELIGIBLE_JOB_STATUSES] },
      ...(since ? { date: { gte: since } } : {}),
    },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      customerId: true,
      customer: { select: { name: true, phone: true } },
    },
  });
  if (jobs.length === 0) return [];

  // One query: which of these customers have a paid invoice?
  const paid = await prisma.invoice.findMany({
    where: {
      businessId,
      status: 'PAID',
      customerId: { in: [...new Set(jobs.map((j) => j.customerId))] },
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  const paidCustomers = new Set(paid.map((p) => p.customerId));

  return jobs
    .filter(
      (j) =>
        checkReviewEligibility(j, paidCustomers.has(j.customerId)).ok === true
    )
    .map(({ status: _status, ...rest }) => rest);
}
