/**
 * Pure, testable job-ops math: labor duration summation, expense totals,
 * job costing (profit/margin), expense + rate validation, and CSV escaping.
 * No I/O, no Prisma — safe to import from server actions and node:test.
 */

/** Expense categories stored on JobExpense.category. */
export const EXPENSE_CATEGORIES = ['MATERIALS', 'TRAVEL', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

export interface LaborEntry {
  clockIn: Date | string;
  clockOut: Date | string | null;
}

/**
 * Total labor minutes across time entries. Entries with a null clockOut
 * (still running) are excluded so an in-progress session can't silently
 * inflate billed hours. Invalid or negative durations count as 0.
 */
export function sumLaborMinutes(entries: LaborEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (!e.clockOut) continue;
    const start = new Date(e.clockIn).getTime();
    const end = new Date(e.clockOut).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) continue;
    total += Math.round((end - start) / 60000);
  }
  return total;
}

export interface ExpenseLike {
  amount: number;
  category: string;
}

export interface ExpenseTotals {
  materials: number;
  travel: number;
  other: number;
  total: number;
}

/** Group expense amounts by category (unknown categories count as OTHER). */
export function expenseTotals(expenses: ExpenseLike[]): ExpenseTotals {
  const t: ExpenseTotals = { materials: 0, travel: 0, other: 0, total: 0 };
  for (const e of expenses) {
    const amt = typeof e.amount === 'number' && Number.isFinite(e.amount) ? e.amount : 0;
    if (amt <= 0) continue;
    if (e.category === 'MATERIALS') t.materials += amt;
    else if (e.category === 'TRAVEL') t.travel += amt;
    else t.other += amt;
    t.total += amt;
  }
  return t;
}

export interface CostInput {
  /** Quoted/agreed price for the job (job.price). */
  price: number | null;
  laborMinutes: number;
  /** Business.defaultHourlyRate (CAD/hr); null = not set. */
  hourlyRate: number | null;
  expenses: ExpenseLike[];
}

export interface CostSummary {
  laborHours: number;
  laborCost: number;
  materialsCost: number;
  travelCost: number;
  otherCost: number;
  expensesTotal: number;
  totalCost: number;
  price: number;
  profit: number;
  /** Percent (0–100+), or null when the price is 0/unknown — never divide by zero. */
  marginPct: number | null;
}

export function summarizeJobCost(input: CostInput): CostSummary {
  const price = typeof input.price === 'number' && Number.isFinite(input.price) ? input.price : 0;
  const laborHours = Math.max(0, input.laborMinutes) / 60;
  const hourlyRate =
    typeof input.hourlyRate === 'number' && Number.isFinite(input.hourlyRate) && input.hourlyRate > 0
      ? input.hourlyRate
      : 0;
  const exp = expenseTotals(input.expenses);
  const laborCost = laborHours * hourlyRate;
  const totalCost = laborCost + exp.total;
  const profit = price - totalCost;
  const marginPct = price > 0 ? (profit / price) * 100 : null;
  return {
    laborHours,
    laborCost,
    materialsCost: exp.materials,
    travelCost: exp.travel,
    otherCost: exp.other,
    expensesTotal: exp.total,
    totalCost,
    price,
    profit,
    marginPct,
  };
}

export interface ValidExpense {
  description: string;
  amount: number;
  category: ExpenseCategory;
  /** Local-midnight Date parsed from a YYYY-MM-DD input. */
  spentAt: Date;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Shared expense-form validation used by the server action (error keys are i18n'd). */
export function validateExpenseInput(raw: {
  description?: unknown;
  amount?: unknown;
  category?: unknown;
  spentAt?: unknown;
}): ValidationResult<ValidExpense> {
  const description = String(raw.description ?? '').trim();
  if (!description) return { ok: false, error: 'errors.expenseDescriptionRequired' };

  const amount = typeof raw.amount === 'number' ? raw.amount : Number(String(raw.amount ?? '').trim());
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: 'errors.expenseAmountInvalid' };

  const category = String(raw.category ?? '').trim().toUpperCase();
  if (!isExpenseCategory(category)) return { ok: false, error: 'errors.expenseCategoryInvalid' };

  const spentAtRaw = String(raw.spentAt ?? '').trim();
  const spentAt = parseDateLocal(spentAtRaw);
  if (!spentAt) return { ok: false, error: 'errors.expenseDateInvalid' };

  return { ok: true, data: { description, amount, category, spentAt } };
}

/** 'YYYY-MM-DD' -> local-midnight Date, or null when invalid. */
export function parseDateLocal(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Validate an hourly-rate form value. Empty string means "clear the rate"
 * (null). Otherwise must be a finite number >= 0.
 */
export function parseHourlyRateInput(raw: unknown): ValidationResult<number | null> {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: true, data: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'errors.rateInvalid' };
  return { ok: true, data: Math.round(n * 100) / 100 };
}

/** Validate a checklist item label (shared by template-apply and ad-hoc add). */
export function validateChecklistLabel(raw: unknown): ValidationResult<string> {
  const label = String(raw ?? '').trim();
  if (!label) return { ok: false, error: 'errors.itemLabelRequired' };
  if (label.length > 200) return { ok: false, error: 'errors.itemLabelTooLong' };
  return { ok: true, data: label };
}

/**
 * Split a textarea's lines into ordered, trimmed labels for a checklist
 * template. Empty lines are dropped; capped to keep templates sane.
 */
export function parseTemplateItemLines(raw: unknown, maxItems = 50): string[] {
  return String(raw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

/** CSV cell escaping: quote cells containing , " or newlines, double inner quotes. */
export function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One-line, accountant-friendly summary of invoice line items. */
export function summarizeLineItems(
  items: { description: string; qty: number; unitPrice: number }[]
): string {
  return items
    .map((i) => `${i.description} (${i.qty} × ${round2(i.unitPrice)})`)
    .join('; ');
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
