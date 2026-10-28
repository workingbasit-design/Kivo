/**
 * Track 8C - batch invoicing + milestone/progress invoicing.
 * Pure helpers: no DB, no I/O, no auth. Safe to unit-test with plain node.
 */
import { calcTax, type TaxLine } from './tax.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type BatchJobInput = {
  id: string;
  title: string;
  price: number;
  customerName: string;
  date: string; // YYYY-MM-DD display key
  /**
   * Slice 2 (2026-10-28): tax follows the job's service property province,
   * so each row carries its own tax lines — one batch can mix provinces
   * (a QC job and an ON job no longer share one business-region rate).
   * The caller resolves these via resolveTaxProvince + getTaxConfig.
   */
  taxes: TaxLine[];
};

export type BatchPreviewRow = {
  jobId: string;
  title: string;
  customerName: string;
  date: string;
  price: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

/**
 * Build one preview row per job. Money math mirrors the server invoice path:
 * subtotal = price, tax per line through the shared tax engine (calcTax -
 * the same function the commit path uses), total = subtotal + tax. The
 * preview can never show a total the server won't store. Each job carries
 * its own tax lines (slice 2: property-driven tax), so mixed-province
 * batches preview each row at its own rate.
 */
export function buildBatchPreview(jobs: BatchJobInput[]): BatchPreviewRow[] {
  return jobs.map((j) => {
    const subtotal = round2(j.price);
    const taxAmount = calcTax(subtotal, { taxes: j.taxes }).taxAmount;
    return {
      jobId: j.id,
      title: j.title,
      customerName: j.customerName,
      date: j.date,
      price: j.price,
      subtotal,
      taxAmount,
      total: round2(subtotal + taxAmount),
    };
  });
}

/**
 * Pure "still uninvoiced" filter for batch preview: drop jobs that already
 * have an invoice row. The server passes the invoice rows it found; callers
 * with no invoices can pass an empty array.
 */
export function excludeInvoicedJobs<T extends { id: string }>(
  jobs: T[],
  invoices: { jobId: string | null }[]
): T[] {
  const invoiced = new Set(
    invoices.map((i) => i.jobId).filter((id): id is string => !!id)
  );
  return jobs.filter((j) => !invoiced.has(j.id));
}

export type MilestoneInput = {
  label: string;
  amount: number | string;
  description?: string | null;
};

export type MilestoneValidation =
  | {
      ok: true;
      clean: { label: string; amount: number; description: string };
    }
  | { ok: false; errorKey: string };

const MAX_MILESTONE_AMOUNT = 1_000_000;

/**
 * Validate milestone invoice input. Returns bilingual error keys from the
 * `billing.errors.*` fragment namespace (resolved by the caller).
 */
export function validateMilestoneInput(
  input: MilestoneInput
): MilestoneValidation {
  const label = String(input.label ?? '').trim();
  if (!label) return { ok: false, errorKey: 'billing.errors.labelRequired' };
  if (label.length > 80)
    return { ok: false, errorKey: 'billing.errors.labelTooLong' };

  const amount =
    typeof input.amount === 'string' ? Number(input.amount) : input.amount;
  if (!Number.isFinite(amount))
    return { ok: false, errorKey: 'billing.errors.amountInvalid' };
  if (amount <= 0) return { ok: false, errorKey: 'billing.errors.amountTooSmall' };
  if (amount > MAX_MILESTONE_AMOUNT)
    return { ok: false, errorKey: 'billing.errors.amountTooLarge' };

  const description = String(input.description ?? '').trim();
  if (description.length > 2000)
    return { ok: false, errorKey: 'billing.errors.descriptionTooLong' };

  return { ok: true, clean: { label, amount: round2(amount), description } };
}
