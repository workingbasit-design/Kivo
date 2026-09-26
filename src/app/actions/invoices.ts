'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { invoiceSchema, paymentSchema, INVOICE_STATUSES } from '@/lib/validations';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import {
  getTaxConfig,
  defaultTaxType,
  totalTaxRate,
  type TaxConfig,
} from '@/lib/tax';
import { formatMoney } from '@/lib/money';
import {
  getActiveShareToken,
  issueShareToken,
  revokeShareTokens,
  setShareTokenExpiry,
} from '@/lib/share';
import { sendPlatformEmail } from '@/lib/messaging/platform-email';
import { appBaseUrl } from '@/lib/app-url';

export type ActionResult = { error?: string; ok?: boolean; id?: string };

const lineItemSchema = z.object({
  desc: z.string().trim().min(1, 'Item description is required').max(200),
  qty: z.coerce.number().min(0.01, 'Qty must be positive').max(100000),
  rate: z.coerce.number().min(0, "Rate can't be negative").max(10_000_000),
});

type LineItem = z.infer<typeof lineItemSchema>;

const TAX_TYPES = [
  'GST',
  'CGST',
  'SGST',
  'IGST',
  'HST',
  'PST',
  'QST',
  'GST+QST',
  'GST+PST',
] as const;

/** Load this business's tax config (region-aware defaults for new invoices). */
async function businessTaxConfig(businessId: string): Promise<TaxConfig> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, taxRegion: true },
  });
  return getTaxConfig(business?.regionCode, business?.taxRegion);
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

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Next INV-0001 style number, scoped per business, retry-safe. */
async function nextInvoiceNumber(businessId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.invoice.findMany({
      where: { businessId },
      select: { number: true },
    });
    let max = 0;
    for (const r of existing) {
      const m = /^INV-(\d+)$/.exec(r.number);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    const number = `INV-${String(max + 1 + attempt).padStart(4, '0')}`;
    const clash = await prisma.invoice.findFirst({
      where: { businessId, number },
      select: { id: true },
    });
    if (!clash) return number;
  }
  return `INV-${Date.now().toString().slice(-6)}`;
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

async function ownedInvoice(businessId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, businessId },
    include: { customer: true, payments: true },
  });
}

/**
 * Create an invoice. Line items come in as JSON; the server recomputes
 * subtotal, tax and total (never trusts client math). Items are stored in
 * the InvoiceLineItem table; `notes` keeps only the user's own note.
 */
export async function createInvoice(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('invoice:create'));
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

  // Tax defaults come from the business's region settings; an explicit,
  // valid form value still wins (backwards compatible).
  const taxConfig = await businessTaxConfig(businessId);

  const taxTypeRaw = String(formData.get('taxType') ?? '').toUpperCase();
  const taxType = (TAX_TYPES as readonly string[]).includes(taxTypeRaw)
    ? taxTypeRaw
    : defaultTaxType(taxConfig);

  const taxRateRaw = formData.get('taxRate');
  const taxRateFromForm =
    taxRateRaw === null || String(taxRateRaw).trim() === ''
      ? null
      : Number(taxRateRaw);

  const parsed = invoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    date: formData.get('date'),
    subtotal: 0, // recomputed below
    taxRate: taxRateFromForm ?? totalTaxRate(taxConfig),
    taxType,
    notes: formData.get('notes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid invoice details.' };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, businessId },
    select: { id: true },
  });
  if (!customer) return { error: 'Customer not found.' };

  // Server-side money math — the single source of truth.
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.rate, 0));
  const taxAmount = round2((subtotal * parsed.data.taxRate) / 100);
  const total = round2(subtotal + taxAmount);

  const notesParts: string[] = [];
  const userNotes = parsed.data.notes?.trim();
  if (userNotes) notesParts.push(userNotes);

  const number = await nextInvoiceNumber(businessId);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number,
        date: new Date(`${parsed.data.date}T00:00:00`),
        subtotal,
        taxRate: parsed.data.taxRate,
        taxType,
        taxAmount,
        total,
        status: 'UNPAID',
        notes: notesParts.join('\n\n') || null,
        customerId: customer.id,
        businessId,
      },
    });
    await tx.invoiceLineItem.createMany({
      data: items.map((item, idx) => ({
        invoiceId: inv.id,
        description: item.desc,
        qty: item.qty,
        unitPrice: item.rate,
        position: idx,
      })),
    });
    return inv;
  });

  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  // Outgoing webhook: invoice created. Best-effort — never fails creation.
  try {
    const { emitWebhookEvent } = await import('@/lib/webhooks');
    await emitWebhookEvent(businessId, 'invoice.created', {
      invoice_id: invoice.id,
      number: invoice.number,
      total: invoice.total,
    });
  } catch (err) {
    console.error('[invoices] invoice.created webhook failed', err);
  }
  redirect(`/invoices/${invoice.id}`);
}

/**
 * Manual status tweaks. PAID is derived from payments — it can't be set by
 * hand; record a payment instead. Can't mark UNPAID once money is recorded.
 */
export async function updateInvoiceStatus(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('invoice:status'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!INVOICE_STATUSES.includes(status as (typeof INVOICE_STATUSES)[number])) {
    return { error: 'Invalid status.' };
  }
  if (status === 'PAID') {
    return { error: 'PAID is set automatically when payments cover the total.' };
  }

  const invoice = await ownedInvoice(businessId, id);
  if (!invoice) return { error: 'Invoice not found.' };
  if (status === 'UNPAID' && invoice.payments.length > 0) {
    return { error: 'This invoice has recorded payments and can\'t go back to UNPAID.' };
  }

  await prisma.invoice.update({ where: { id, businessId }, data: { status } });
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

/** Delete an invoice and its payments (cascade). */
export async function deleteInvoice(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('invoice:delete'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const invoice = await ownedInvoice(businessId, id);
  if (!invoice) return { error: 'Invoice not found.' };
  if (invoice.status === 'PAID') {
    return { error: 'Paid invoices are kept as records and can\'t be deleted.' };
  }

  await prisma.invoice.delete({ where: { id, businessId } });
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  redirect('/invoices');
}

function deriveStatus(total: number, paid: number): string {
  if (paid >= total - 0.009) return 'PAID';
  if (paid > 0) return 'PARTIALLY PAID';
  return 'UNPAID';
}

/**
 * Record a payment against an invoice. Updates the invoice status from the
 * actual money received — the single source of truth for "paid or not".
 */
export async function recordPayment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('payment:record'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const parsed = paymentSchema.safeParse({
    invoiceId: formData.get('invoiceId'),
    amount: formData.get('amount'),
    provider: formData.get('provider'),
    transactionId: formData.get('transactionId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid payment details.' };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: parsed.data.invoiceId, businessId },
    include: {
      payments: { select: { amount: true } },
      business: { select: { currency: true } },
    },
  });
  if (!invoice) return { error: 'Invoice not found.' };

  const alreadyPaid = round2(invoice.payments.reduce((s, p) => s + p.amount, 0));
  const remaining = round2(invoice.total - alreadyPaid);
  if (remaining <= 0) {
    return { error: 'This invoice is already paid in full.' };
  }
  if (parsed.data.amount > remaining + 0.009) {
    return {
      error: `Amount exceeds the remaining balance of ${formatMoney(remaining, invoice.business.currency)}.`,
    };
  }

  const payment = await prisma.payment.create({
    data: {
      amount: round2(parsed.data.amount),
      provider: parsed.data.provider,
      transactionId: parsed.data.transactionId || null,
      status: 'COMPLETED',
      invoiceId: invoice.id,
    },
  });

  const newPaid = round2(alreadyPaid + payment.amount);
  const newStatus = deriveStatus(invoice.total, newPaid);
  await prisma.invoice.update({
    where: { id: invoice.id, businessId },
    data: { status: newStatus },
  });

  // Outgoing webhooks: payment recorded (+ invoice paid when fully paid).
  // Best-effort — never fails the payment recording.
  try {
    const { emitWebhookEvent } = await import('@/lib/webhooks');
    await emitWebhookEvent(businessId, 'payment.recorded', {
      payment_id: payment.id,
      invoice_id: invoice.id,
      amount: payment.amount,
      provider: payment.provider,
    });
    if (newStatus === 'PAID') {
      await emitWebhookEvent(businessId, 'invoice.paid', {
        invoice_id: invoice.id,
        number: invoice.number,
        total: invoice.total,
      });
    }
    // Push notification: money in. Best-effort, bilingual copy.
    const { pushToBusiness } = await import('@/lib/webpush');
    await pushToBusiness(businessId, {
      title: 'Payment received · Paiement reçu',
      body: `${formatMoney(payment.amount, invoice.business.currency)} — ${invoice.number}`,
      url: `/invoices/${invoice.id}`,
      tag: `payment-${payment.id}`,
    });
  } catch (err) {
    console.error('[invoices] payment webhooks failed', err);
  }

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath('/dashboard');
  return { ok: true, id: payment.id };
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

/** Current usable share token for an invoice, for the detail-page UI. */
export async function getInvoiceShareState(
  invoiceId: string
): Promise<ShareLinkState> {
  const { businessId } = await requireAuth();
  const rec = await getActiveShareToken(businessId, 'INVOICE', { invoiceId });
  if (!rec) return null;
  return {
    id: rec.id,
    token: rec.token,
    expiresAt: rec.expiresAt ? rec.expiresAt.toISOString().slice(0, 10) : null,
  };
}

/**
 * Create (or regenerate) the public share link for an invoice.
 * Regenerating revokes the previous token immediately.
 */
export async function regenerateInvoiceShareLink(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult & { token?: string; tokenId?: string }> {
  const limited = checkLimit(await clientKey('invoice:share'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const invoiceId = String(formData.get('invoiceId') ?? '');
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    select: { id: true },
  });
  if (!invoice) return { error: 'Invoice not found.' };

  const expiresAt = parseExpiryInput(formData.get('expiresAt'));
  if (expiresAt === 'invalid') {
    return { error: 'Expiry date must be a valid future date.' };
  }

  const rec = await issueShareToken(businessId, 'INVOICE', { invoiceId }, expiresAt);
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, token: rec.token, tokenId: rec.id };
}

/** Revoke the invoice's share link(s). The public URL stops working at once. */
export async function revokeInvoiceShareLink(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('invoice:share'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const invoiceId = String(formData.get('invoiceId') ?? '');
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    select: { id: true },
  });
  if (!invoice) return { error: 'Invoice not found.' };

  await revokeShareTokens(businessId, 'INVOICE', { invoiceId });
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

/**
 * Pro-initiated "send invoice to customer" via email.
 *
 * Ensures the invoice has a usable public payment link (/i/[token]), emails
 * it to the customer (bilingual body), and stamps sentAt — but ONLY when the
 * email actually sends. Note: invoice `status` stays payment-oriented
 * (UNPAID / PARTIALLY PAID / PAID); `sentAt` is the honest "was emailed"
 * signal, not a fake status.
 */
export async function sendInvoiceEmail(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('invoice:send-email'));
  if (limited) return limited;

  let businessId: string;
  try {
    ({ businessId } = await requireAuth());
  } catch {
    return { error: 'Please log in again.' };
  }

  const id = String(formData.get('id') ?? '');
  const invoice = await ownedInvoice(businessId, id);
  if (!invoice) return { error: 'Invoice not found.' };

  const toEmail = (invoice.customer.email ?? '').trim();
  if (!toEmail) {
    return {
      error:
        'This customer has no email address. Add one to the customer record first — or use the WhatsApp / SMS buttons on this page instead.',
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, currency: true },
  });
  const businessName = business?.name ?? 'Your pro';
  const currency = business?.currency ?? 'CAD';

  // Ensure a usable public payment link for the email.
  let token = (await getActiveShareToken(businessId, 'INVOICE', { invoiceId: id }))
    ?.token;
  if (!token) {
    const rec = await issueShareToken(businessId, 'INVOICE', { invoiceId: id }, null);
    token = rec.token;
  }
  const base = await appBaseUrl();
  if (!base) {
    return { error: 'Could not build the invoice link. Please try again.' };
  }
  const link = `${base}/i/${token}`;

  const total = formatMoney(invoice.total, currency);
  const subject = `Invoice ${invoice.number} from ${businessName} / Facture ${invoice.number} de ${businessName}`;
  const body = [
    `Hi ${invoice.customer.name},`,
    '',
    `Here is invoice ${invoice.number} from ${businessName} — total ${total}.`,
    `View it and pay online here: ${link}`,
    '',
    'Just reply to this email if you have any questions.',
    '',
    '---',
    '',
    `Bonjour ${invoice.customer.name},`,
    '',
    `Voici la facture ${invoice.number} de ${businessName} — total ${total}.`,
    `Consultez-la et payez en ligne ici : ${link}`,
    '',
    'Répondez simplement à ce courriel si vous avez des questions.',
  ].join('\n');

  const sent = await sendPlatformEmail(toEmail, subject, body, {
    fromName: `${businessName} via EveryJob`,
  });
  if (!sent.ok) {
    return {
      error: sent.notConfigured
        ? 'Email is not configured yet — the workspace owner needs to add RESEND_API_KEY. The WhatsApp / SMS buttons on this page still work.'
        : `Email could not be sent (${sent.error ?? 'unknown error'}). Nothing was marked as sent.`,
    };
  }

  await prisma.invoice.update({ where: { id, businessId }, data: { sentAt: new Date() } });
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

/** Set or clear the expiry date of the invoice's current share token. */
export async function setInvoiceShareLinkExpiry(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = checkLimit(await clientKey('invoice:share'));
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
  revalidatePath('/invoices');
  return { ok: true };
}
