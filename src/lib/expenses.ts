/**
 * Pure helpers for standalone expense tracking (/expenses).
 * No I/O, no Prisma - safe for node:test.
 */

export const EXPENSE_CATEGORIES = ['MATERIALS', 'TRAVEL', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

/** Receipt photo MIME allowlist. */
const RECEIPT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

export function isReceiptMime(mime: string): boolean {
  return (RECEIPT_MIMES as readonly string[]).includes(mime);
}

export interface ValidExpenseForm {
  description: string;
  amount: number;
  category: ExpenseCategory;
  spentAt: string; // YYYY-MM-DD
  jobId: string | null;
  note: string | null;
}

export type ExpenseFormValidation =
  | { ok: true; data: ValidExpenseForm }
  | { ok: false; error: string };

/**
 * Validate a standalone expense form. Returns i18n error keys on failure
 * (the caller maps them through t()).
 */
export function validateExpenseForm(raw: {
  description?: unknown;
  amount?: unknown;
  category?: unknown;
  spentAt?: unknown;
  jobId?: unknown;
  note?: unknown;
}): ExpenseFormValidation {
  const description = String(raw.description ?? '').trim();
  if (!description) return { ok: false, error: 'errors.expenseDescriptionRequired' };

  const amount = Number(String(raw.amount ?? '').trim());
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: 'errors.expenseAmountInvalid' };

  const category = String(raw.category ?? '').trim().toUpperCase();
  if (!isExpenseCategory(category))
    return { ok: false, error: 'errors.expenseCategoryInvalid' };

  const spentAt = String(raw.spentAt ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
    return { ok: false, error: 'errors.expenseDateInvalid' };
  }
  const d = new Date(spentAt + 'T00:00:00');
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'errors.expenseDateInvalid' };
  }
  // Guard against overflow dates like 2026-13-99 (Date parses them leniently).
  const [y, m, day] = spentAt.split('-').map(Number);
  if (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day) {
    return { ok: false, error: 'errors.expenseDateInvalid' };
  }

  const jobIdRaw = String(raw.jobId ?? '').trim();
  const noteRaw = String(raw.note ?? '').trim();

  return {
    ok: true,
    data: {
      description,
      amount,
      category,
      spentAt,
      jobId: jobIdRaw || null,
      note: noteRaw || null,
    },
  };
}

/**
 * Build a safe Vercel Blob pathname for a receipt photo.
 * Sanitizes the business id and file extension; hostile input like
 * '../../etc/passwd.png' collapses to a safe name.
 */
export function buildExpenseReceiptPathname(input: {
  businessId: string;
  uid: string;
  fileName: string;
}): string {
  const safeBiz = String(input.businessId ?? '').replace(/[^a-zA-Z0-9]/g, '');
  const safeUid = String(input.uid ?? '').replace(/[^a-zA-Z0-9]/g, '');
  const rawName = String(input.fileName ?? '');
  const extMatch = rawName.match(/\.([a-zA-Z0-9]{1,5})$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.png';
  // Sanitize the basename: strip directories and hostile characters.
  const base = rawName
    .split('/')
    .pop()!
    .replace(/\.[a-zA-Z0-9]{1,5}$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40) || 'receipt';
  return `attachments/${safeBiz}/expense/${safeUid}-${base}${ext}`;
}

export interface ExpenseFilters {
  category: 'ALL' | ExpenseCategory;
  jobId: string;
  from: string;
  to: string;
  q: string;
}

/** Normalize expense list query params (categoryd, dates validated). */
export function parseExpenseFilters(params: {
  category?: string;
  jobId?: string;
  from?: string;
  to?: string;
  q?: string;
}): ExpenseFilters {
  const cat = String(params.category ?? '').trim().toUpperCase();
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  return {
    category: isExpenseCategory(cat) ? cat : 'ALL',
    jobId: String(params.jobId ?? '').trim() || 'ALL',
    from: validDate(String(params.from ?? '').trim()),
    to: validDate(String(params.to ?? '').trim()),
    q: String(params.q ?? '').trim(),
  };
}
