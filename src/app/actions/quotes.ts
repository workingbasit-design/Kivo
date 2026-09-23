'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { quoteSchema, QUOTE_STATUSES } from '@/lib/validations';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getTaxConfig, totalTaxRate } from '@/lib/tax';
import { computeQuoteTotals, type DiscountType } from '@/lib/quote-totals';
import {
  getActiveShareToken,
  issueShareToken,
  revokeShareTokens,
  setShareTokenExpiry,
  resolveShareToken,
} from '@/lib/share';
import { convertedJobDetails } from '@/lib/quotes';

export type ActionResult = { error?: string; ok?: boolean; id?: string };

const lineItemSchema = z.object({
  desc: z.string().trim().min(1, 'Item description is required').max(200),
  qty: z.coerce.number().min(0.01, 'Qty must be positive').max(100000),
  rate: z.coerce.number().min(0, "Rate can't be negative").max(10_000_000),
});

type LineItem = z.infer<typeof lineItemSchema>;

/** Parse an optional discount: type in PERCENT/AMOUNT/empty, value ≥ 0, PERCENT ≤ 100. */
function parseDiscount(formData: FormData): {
  type: DiscountType;
  value: number | null;
  error?: string;
} {
  const rawType = String(formData.get('discountType') ?? '').trim().toUpperCase();
  if (!rawType) return { type: null, value: null };
  if (rawType !== 'PERCENT' && rawType !== 'AMOUNT') {
    return { type: null, value: null, error: 'Invalid discount type.' };
  }
  const value = Number(formData.get('discountValue'));
  if (!Number.isFinite(value) || value < 0) {
    return { type: null, value: null, error: 'Discount must be 0 or more.' };
  }
  if (rawType === 'PERCENT' && value > 100) {
    return { type: null, value: null, error: 'Percentage discounts max out at 100%.' };
  }
  if (value === 0) return { type: null, value: null };
  return { type: rawType as DiscountType, value: Math.round(value * 100) / 100 };
}

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `${prefix}:${ip}`;
}

function checkLimit(key: string): ActionResult | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { error: `Too many requests. Try again in ${secs}s.` };
  }
  return null;
}

/** Next Q-0001 style number, scoped per business, retry-safe. */
async function nextQuoteNumber(businessId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.quote.findMany({
      where: { businessId },
      select: { number: true },
    });
    let max = 0;
    for (const r of existing) {
      const m = /^Q-(\d+)$/.exec(r.number);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    const number = `Q-${String(max + 1 + attempt).padStart(4, '0')}`;
    const clash = await prisma.quote.findFirst({
      where: { businessId, number },
      select: { id: true },
    });
    if (!clash) return number;
  }
  // Fallback: timestamp-based, guaranteed unique.
  return `Q-${Date.now().toString().slice(-6)}`;
}

function parseLineItems(raw: string | null): { items?: LineItem[]; error?: string } {
  if (!raw) return { items: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Invalid line items.' };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: 'Add at least one line item.' };
  }
  if (parsed.length > 100) return { error: 'Too many line items (max 100).' };
  const items: LineItem[] = [];
  for (const row of parsed) {
    const r = lineItemSchema.safeParse(row);
    if (!r.success) return { error: r.error.issues[0]?.message ?? 'Invalid line item.' };
    items.push(r.data);
  }
  return { items };
}

async function ownedQuote(businessId: string, id: string) {
  return prisma.quote.findFirst({
    where: { id, businessId },
    include: { customer: true },
  });
}

/**
 * Create a quote. Line items come in as JSON; the server recomputes the
 * subtotal and adds tax from the business's region settings (never trusts
 * client math), so the stored total is tax-inclusive.
 */
export async function createQuote(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:create'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const { items, error: itemsError } = parseLineItems(
    formData.get('itemsJson') as string | null
  );
  if (itemsError || !items) return { error: itemsError ?? 'Invalid line items.' };

  // Discount comes from the form; anything invalid is a hard error.
  const discount = parseDiscount(formData);
  if (discount.error) return { error: discount.error };

  // Server-side money math — the single source of truth. Discount applies
  // before tax (tax comes from the business's region settings), so the
  // stored total is tax-inclusive on the discounted amount.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, taxRegion: true },
  });
  const taxConfig = getTaxConfig(business?.regionCode, business?.taxRegion);
  const totals = computeQuoteTotals(
    items.map((i) => ({ qty: i.qty, unitPrice: i.rate })),
    discount,
    totalTaxRate(taxConfig)
  );
  const total = totals.total;

  const parsed = quoteSchema.safeParse({
    title: formData.get('title'),
    customerId: formData.get('customerId'),
    total,
    status: 'DRAFT',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid quote details.' };
  }

  // Verify the customer belongs to this business.
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, businessId },
    select: { id: true },
  });
  if (!customer) return { error: 'Customer not found.' };

  const number = await nextQuoteNumber(businessId);

  // The quote and its line items are created atomically; `position` is the
  // display order on the detail page.
  const quote = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        number,
        title: parsed.data.title,
        total,
        discountType: discount.type,
        discountValue: discount.value,
        status: 'DRAFT',
        customerId: customer.id,
        businessId,
      },
    });
    await tx.quoteLineItem.createMany({
      data: items.map((item, index) => ({
        quoteId: q.id,
        description: item.desc,
        qty: item.qty,
        unitPrice: item.rate,
        position: index,
      })),
    });
    return q;
  });

  revalidatePath('/quotes');
  redirect(`/quotes/${quote.id}`);
}

/**
 * Replace a DRAFT quote's line items and discount. Only drafts are editable —
 * once a quote moves (SENT/APPROVED/…), its items are a record of what was
 * quoted. The total is recomputed server-side from the new items.
 */
export async function updateQuoteItems(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:items'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const quote = await ownedQuote(businessId, id);
  if (!quote) return { error: 'Quote not found.' };
  if (quote.status !== 'DRAFT') {
    return { error: 'Only draft quotes can be edited.' };
  }

  const { items, error: itemsError } = parseLineItems(
    formData.get('itemsJson') as string | null
  );
  if (itemsError || !items) return { error: itemsError ?? 'Invalid line items.' };

  const discount = parseDiscount(formData);
  if (discount.error) return { error: discount.error };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, taxRegion: true },
  });
  const taxConfig = getTaxConfig(business?.regionCode, business?.taxRegion);
  const totals = computeQuoteTotals(
    items.map((i) => ({ qty: i.qty, unitPrice: i.rate })),
    discount,
    totalTaxRate(taxConfig)
  );

  await prisma.$transaction([
    prisma.quoteLineItem.deleteMany({ where: { quoteId: id } }),
    prisma.quoteLineItem.createMany({
      data: items.map((item, index) => ({
        quoteId: id,
        description: item.desc,
        qty: item.qty,
        unitPrice: item.rate,
        position: index,
      })),
    }),
    prisma.quote.update({
      where: { id },
      data: {
        discountType: discount.type,
        discountValue: discount.value,
        total: totals.total,
      },
    }),
  ]);

  revalidatePath(`/quotes/${id}`);
  return { ok: true };
}

const MANUAL_DEPOSIT_PROVIDERS = ['INTERAC', 'CASH', 'CHEQUE'] as const;

/**
 * Record a deposit the owner collected outside EveryJob (Interac e-Transfer,
 * cash, cheque). This is record-keeping only — no money moves through
 * EveryJob. STRIPE can never be used here; Stripe card collection lives in
 * Track 9's flow and records COMPLETED rows via its own action.
 */
export async function recordQuoteDeposit(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:deposit-record'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const quoteId = String(formData.get('quoteId') ?? '');
  const quote = await ownedQuote(businessId, quoteId);
  if (!quote) return { error: 'Quote not found.' };

  const amount = Math.round(Number(formData.get('amount')) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter an amount greater than 0.' };
  }
  if (amount > quote.total) {
    return { error: "The deposit can't exceed the quote total." };
  }

  const provider = String(formData.get('provider') ?? '').trim().toUpperCase();
  if (!(MANUAL_DEPOSIT_PROVIDERS as readonly string[]).includes(provider)) {
    return { error: 'Choose a valid payment method.' };
  }

  const noteRaw = String(formData.get('note') ?? '').trim();
  if (noteRaw.length > 500) {
    return { error: 'Notes are too long (max 500 characters).' };
  }

  await prisma.quoteDeposit.create({
    data: {
      quoteId,
      businessId,
      amount,
      provider,
      status: 'COMPLETED',
      note: noteRaw ? noteRaw : null,
    },
  });

  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT', 'DECLINED'],
  SENT: ['DRAFT', 'APPROVED', 'DECLINED'],
  APPROVED: [],
  DECLINED: ['DRAFT'],
};

/** Move a quote through DRAFT → SENT → APPROVED / DECLINED. */
export async function updateQuoteStatus(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:status'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!QUOTE_STATUSES.includes(status as (typeof QUOTE_STATUSES)[number])) {
    return { error: 'Invalid status.' };
  }

  const quote = await ownedQuote(businessId, id);
  if (!quote) return { error: 'Quote not found.' };

  const allowed = QUOTE_TRANSITIONS[quote.status] ?? [];
  if (!allowed.includes(status)) {
    return { error: `Can't move quote from ${quote.status} to ${status}.` };
  }

  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id}`);
  return { ok: true };
}

/** Convert an APPROVED quote into a scheduled job. */
export async function convertQuoteToJob(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:convert'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      addons: { select: { title: true, price: true, selected: true } },
    },
  });
  if (!quote) return { error: 'Quote not found.' };
  if (quote.status !== 'APPROVED') {
    return { error: 'Only approved quotes can be converted to jobs.' };
  }

  // The client-approved total includes any selected add-ons — the job
  // price and notes must reflect what was actually agreed.
  const { price: jobPrice, notes: jobNotes } = convertedJobDetails(
    quote.number,
    quote.total,
    quote.addons
  );

  const job = await prisma.job.create({
    data: {
      title: quote.title,
      date: new Date(),
      price: jobPrice,
      status: 'SCHEDULED',
      notes: jobNotes,
      customerId: quote.customerId,
      businessId,
    },
  });

  revalidatePath('/jobs');
  revalidatePath('/schedule');
  redirect(`/jobs/${job.id}`);
}

/** Delete a quote (drafts/sent/declined only — approved quotes stay as records). */
export async function deleteQuote(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:delete'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const quote = await ownedQuote(businessId, id);
  if (!quote) return { error: 'Quote not found.' };
  if (quote.status === 'APPROVED') {
    return { error: 'Approved quotes are kept as records and can\'t be deleted.' };
  }

  await prisma.quote.delete({ where: { id } });
  revalidatePath('/quotes');
  redirect('/quotes');
}

/* ------------------------------------------------------------------ */
/* Quote add-ons (optional extras the client can toggle on the portal) */
/* ------------------------------------------------------------------ */

const addonSchema = z.object({
  title: z.string().trim().min(1, 'Add-on name is required').max(200),
  price: z.coerce.number().min(0, "Price can't be negative").max(10_000_000),
});

/** The quote plus an editability check for add-ons. Approved quotes are records. */
async function editableQuote(businessId: string, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    select: { id: true, status: true },
  });
  if (!quote) return { error: 'Quote not found.' } as const;
  if (quote.status === 'APPROVED') {
    return { error: "Add-ons can't be changed after a quote is approved." } as const;
  }
  return { quote } as const;
}

async function ownedAddon(businessId: string, id: string) {
  return prisma.quoteAddon.findFirst({
    where: { id, quote: { businessId } },
    include: { quote: { select: { id: true, status: true } } },
  });
}

/** Add an optional extra (title + price ≥ 0) to a quote. Draft/sent/declined only. */
export async function createQuoteAddon(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:addon'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const quoteId = String(formData.get('quoteId') ?? '');
  const parsed = addonSchema.safeParse({
    title: formData.get('title'),
    price: formData.get('price'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid add-on.' };
  }

  const editable = await editableQuote(businessId, quoteId);
  if ('error' in editable) return { error: editable.error };

  const sortOrder = await prisma.quoteAddon.count({ where: { quoteId } });
  await prisma.quoteAddon.create({
    data: {
      quoteId,
      title: parsed.data.title,
      price: parsed.data.price,
      selected: false,
      sortOrder,
    },
  });

  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

/** Edit an add-on's title/price. Draft/sent/declined quotes only. */
export async function updateQuoteAddon(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:addon'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const parsed = addonSchema.safeParse({
    title: formData.get('title'),
    price: formData.get('price'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid add-on.' };
  }

  const addon = await ownedAddon(businessId, id);
  if (!addon) return { error: 'Add-on not found.' };
  if (addon.quote.status === 'APPROVED') {
    return { error: "Add-ons can't be changed after a quote is approved." };
  }

  await prisma.quoteAddon.update({
    where: { id },
    data: { title: parsed.data.title, price: parsed.data.price },
  });

  revalidatePath(`/quotes/${addon.quote.id}`);
  return { ok: true };
}

/** Delete an add-on. Draft/sent/declined quotes only. */
export async function deleteQuoteAddon(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:addon'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const addon = await ownedAddon(businessId, id);
  if (!addon) return { error: 'Add-on not found.' };
  if (addon.quote.status === 'APPROVED') {
    return { error: "Add-ons can't be changed after a quote is approved." };
  }

  await prisma.quoteAddon.delete({ where: { id } });
  revalidatePath(`/quotes/${addon.quote.id}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Public share links (revocable, expirable tokens)                    */
/* ------------------------------------------------------------------ */

export type ShareLinkState = {
  id: string;
  token: string;
  expiresAt: string | null; // YYYY-MM-DD or null
} | null;

/** Parse an optional YYYY-MM-DD expiry. 'invalid' when in the past. */
function parseExpiryInput(
  raw: FormDataEntryValue | null
): Date | null | 'invalid' {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'invalid';
  const d = new Date(`${s}T23:59:59`);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return 'invalid';
  return d;
}

/** Current usable share token for a quote, for the detail-page UI. */
export async function getQuoteShareState(
  quoteId: string
): Promise<ShareLinkState> {
  const { businessId } = await requireAuth();
  const rec = await getActiveShareToken(businessId, 'QUOTE', { quoteId });
  if (!rec) return null;
  return {
    id: rec.id,
    token: rec.token,
    expiresAt: rec.expiresAt ? rec.expiresAt.toISOString().slice(0, 10) : null,
  };
}

/**
 * Create (or regenerate) the public share link for a quote.
 * Regenerating revokes the previous token immediately.
 */
export async function regenerateQuoteShareLink(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult & { token?: string; tokenId?: string }> {
  const limited = checkLimit(await clientKey('quote:share'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const quoteId = String(formData.get('quoteId') ?? '');
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    select: { id: true },
  });
  if (!quote) return { error: 'Quote not found.' };

  const expiresAt = parseExpiryInput(formData.get('expiresAt'));
  if (expiresAt === 'invalid') {
    return { error: 'Expiry date must be a valid future date.' };
  }

  const rec = await issueShareToken(businessId, 'QUOTE', { quoteId }, expiresAt);
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true, token: rec.token, tokenId: rec.id };
}

/** Revoke the quote's share link(s). The public URL stops working at once. */
export async function revokeQuoteShareLink(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:share'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const quoteId = String(formData.get('quoteId') ?? '');
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    select: { id: true },
  });
  if (!quote) return { error: 'Quote not found.' };

  await revokeShareTokens(businessId, 'QUOTE', { quoteId });
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

/** Set or clear the expiry date of the quote's current share token. */
export async function setQuoteShareLinkExpiry(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('quote:share'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const tokenId = String(formData.get('tokenId') ?? '');
  const expiresAt = parseExpiryInput(formData.get('expiresAt'));
  if (expiresAt === 'invalid') {
    return { error: 'Expiry date must be a valid future date.' };
  }

  const rec = await setShareTokenExpiry(businessId, tokenId, expiresAt);
  if (!rec) return { error: 'Share link not found.' };
  revalidatePath('/quotes');
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Public portal decision via token (no auth; token is the capability) */
/* ------------------------------------------------------------------ */

export type PortalDecisionResult = {
  error?: string;
  ok?: boolean;
  status?: string;
};

const PORTAL_LIMIT = { limit: 30, windowMs: 60 * 1000 };

function checkPortalLimit(key: string): PortalDecisionResult | null {
  const rl = rateLimit(key, PORTAL_LIMIT);
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return { error: `Too many requests. Try again in ${secs}s.` };
  }
  return null;
}

/**
 * Approve/decline a quote from the public portal using its share token.
 * Same transition rules as the in-app action; the token stands in for auth.
 *
 * On APPROVED, the client's add-on choices are persisted (chosen add-ons
 * become selected, everything else is deselected) so the stored quote
 * records exactly what the client agreed to. Status flow is unchanged.
 */
export async function portalQuoteDecisionByToken(
  token: string,
  decision: 'APPROVED' | 'DECLINED',
  addonIds: string[] = []
): Promise<PortalDecisionResult> {
  const hit = checkPortalLimit(await clientKey('portal-quote-token'));
  if (hit) return hit;

  const resolved = await resolveShareToken(token, 'QUOTE');
  if (!resolved.ok) {
    return { error: 'This link is invalid or has expired.' };
  }
  const quoteId = resolved.rec.quoteId;
  if (!quoteId) return { error: 'This link is invalid or has expired.' };

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId: resolved.rec.businessId },
    select: { id: true, status: true },
  });
  if (!quote) return { error: 'This link is invalid or has expired.' };
  if (quote.status === 'APPROVED' || quote.status === 'DECLINED') {
    return { error: 'This quote has already been responded to.', status: quote.status };
  }
  if (quote.status !== 'SENT') {
    return { error: 'This quote is not ready for approval yet.' };
  }

  if (decision === 'APPROVED') {
    // Scope the choice to this quote's own add-ons only; the token already
    // proves the caller may act on this quote.
    const chosen = [
      ...new Set(
        addonIds.filter(
          (id) => typeof id === 'string' && id.length > 0 && id.length <= 64
        )
      ),
    ];
    await prisma.$transaction([
      prisma.quoteAddon.updateMany({
        where: { quoteId, id: { in: chosen } },
        data: { selected: true },
      }),
      prisma.quoteAddon.updateMany({
        where: { quoteId, id: { notIn: chosen } },
        data: { selected: false },
      }),
    ]);
  }

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: decision },
    select: { status: true },
  });

  revalidatePath(`/q/${token}`);
  return { ok: true, status: updated.status };
}
