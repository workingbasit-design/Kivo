/**
 * Track 8C — batch invoicing + milestone/progress invoicing.
 * Pure helpers: no DB, no I/O, no auth. Safe to unit-test with plain node.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type BatchJobInput = {
  id: string;
  title: string;
  price: number;
  customerName: string;
  date: string; // YYYY-MM-DD display key
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
 * subtotal = price, tax on the rounded subtotal, total = subtotal + tax.
 */
export function buildBatchPreview(
  jobs: BatchJobInput[],
  taxRate: number
): BatchPreviewRow[] {
  return jobs.map((j) => {
    const subtotal = round2(j.price);
    const taxAmount = round2((subtotal * taxRate) / 100);
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
