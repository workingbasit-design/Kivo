import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { rateLimit } from '@/lib/rate-limit';
import { runCopilot, type JobDraft, type CustomerDraft, type QuoteDraft, type CopilotHistoryItem } from '@/lib/copilot/engine';
import { tryAnthropicReply } from '@/lib/copilot/anthropic';
import { buildConfirmReply } from '@/lib/copilot/confirm-reply';
import { findCustomerNameCandidates, exactNameMatch } from '@/lib/copilot/match-customer';
import { formatDateShort } from '@/lib/utils';
import { formatMoney, centsToDollars, dollarsToCents } from '@/lib/money';
import { getTaxConfig } from '@/lib/tax';
import { computeQuoteTotals } from '@/lib/quote-totals';
import { nextDocumentNumber } from '@/lib/numbering';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { getLocale } from '@/lib/i18n/server';

export const maxDuration = 30;

/**
 * GET /api/copilot?type=customers&q=… | ?type=services
 *
 * Lookup lists for the guided copilot flows (pick a customer, pick a
 * service). Tenant-scoped, auth-checked, rate-limited. Read-only.
 */
const lookupQuerySchema = z.object({
  type: z.enum(['customers', 'services']),
  q: z.string().trim().max(80).optional(),
});

export async function GET(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`copilot-lookup:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = lookupQuerySchema.safeParse({
    type: url.searchParams.get('type'),
    q: url.searchParams.get('q') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lookup request' }, { status: 400 });
  }

  if (parsed.data.type === 'services') {
    const services = await prisma.service.findMany({
      where: { businessId },
      select: { id: true, name: true, priceCents: true },
      orderBy: { name: 'asc' },
      take: 12,
    });
    // API contract stays in dollars (the copilot widget renders s.price as
    // $X) - map the cent column at the DB boundary.
    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: centsToDollars(s.priceCents),
      })),
    });
  }

  const q = parsed.data.q;
  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: { id: true, name: true, phone: true, address: true },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  });
  return NextResponse.json({ customers });
}

/** Strict YYYY-MM-DD: rejects rolled-over dates like 2026-02-30. */
const strictDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Invalid date');

const confirmSchema = z.object({
  confirm: z.literal(true),
  previewType: z.literal('job').optional(), // default for older clients
  preview: z.object({
    title: z.string().min(1).max(120),
    date: strictDate,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    customerName: z.string().min(1).max(80),
    phone: z.string().regex(/^[2-9]\d{9}$/).nullable().optional(), // NANP 10-digit
    address: z.string().max(200).nullable().optional(),
    price: z.number().int().min(0).max(10000000).nullable().optional(),
  }),
  // Client-generated idempotency key (one per booking preview). Optional -
  // when absent the server derives a deterministic key from the draft.
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

/** Confirming a previewed NEW CUSTOMER - same explicit-confirm boundary as jobs. */
const customerConfirmSchema = z.object({
  confirm: z.literal(true),
  previewType: z.literal('customer'),
  preview: z.object({
    name: z.string().min(1).max(80),
    phone: z.string().regex(/^[2-9]\d{9}$/).nullable().optional(), // NANP 10-digit
    address: z.string().max(200).nullable().optional(),
  }),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

/**
 * Confirming a previewed QUOTE draft. There was no quote-confirm path at
 * all before 2026-11-08: the widget coerced previewKind 'quote' to 'job'
 * and rendered the job card, whose confirm is permanently disabled without
 * a date - so a drafted quote could never be created (2026-11-08 deep test).
 * A quote needs an EXISTING customer (never auto-created from a draft) and
 * a price (the preview card requires one before confirming).
 */
const quoteConfirmSchema = z.object({
  confirm: z.literal(true),
  previewType: z.literal('quote'),
  preview: z.object({
    title: z.string().min(1).max(120),
    customerName: z.string().min(1).max(80),
    price: z.number().int().min(0).max(10000000).nullable().optional(),
  }),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  // Recent conversation turns for pronoun follow-ups ("move it to tomorrow").
  // Minimal context: the last few messages only.
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
    )
    .max(6)
    .optional(),
});

export async function POST(req: Request) {
  // CSRF: API routes get no framework origin protection (unlike server actions).
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const fr = (await getLocale()) === 'fr';
  const tr = (en: string, frText: string) => (fr ? frText : en);

  // getSession() throws DatabaseUnavailableError during a DB outage (by
  // design, so an outage never looks like a logout) - catch it here so the
  // widget gets a structured JSON error, not an unhandled 500 HTML page.
  let session: Awaited<ReturnType<typeof getSession>>;
  let membership: Awaited<ReturnType<typeof getActiveMembershipForUser>>;
  try {
    session = await getSession();
    membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  } catch (err) {
    console.error('[copilot] session lookup failed', err);
    return NextResponse.json(
      { error: tr('Something went wrong on my side - please try again in a moment.', 'Un problème est survenu de mon côté - réessayez dans un instant.') },
      { status: 500 }
    );
  }
  const businessId = membership?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 30 copilot calls/min per user
  const rl = rateLimit(`copilot:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: tr('Too many requests - please wait a moment and try again.', 'Trop de requêtes - attendez un moment et réessayez.') },
      { status: 429 }
    );
  }
  // B13.5: per-business daily usage cap (200/day) - bounds LLM spend and
  // abuse even when spread across many users of one business.
  const rlDay = rateLimit(`copilot-day:${businessId}`, { limit: 200, windowMs: 24 * 60 * 60_000 });
  if (!rlDay.ok) {
    return NextResponse.json(
      { error: tr("This business has reached today's copilot limit. Try again tomorrow.", "Cette entreprise a atteint la limite quotidienne de l'assistant. Réessayez demain.") },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // --- Confirm a previously previewed job or customer -----------------------
  // Customer confirm carries previewType: 'customer'; try it first.
  const asCustomerConfirm = customerConfirmSchema.safeParse(body);
  if (asCustomerConfirm.success) {
    const rlConfirm = rateLimit(`copilot-confirm:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rlConfirm.ok) {
      return NextResponse.json(
        { error: tr('Too many confirm requests - please wait a moment and try again.', 'Trop de confirmations - attendez un moment et réessayez.') },
        { status: 429 }
      );
    }
    return handleCustomerConfirm(
      businessId,
      asCustomerConfirm.data.preview,
      asCustomerConfirm.data.idempotencyKey,
      fr
    );
  }

  const asConfirm = confirmSchema.safeParse(body);
  if (asConfirm.success) {
    // Job creation is higher-stakes than chat: tighter per-user budget.
    const rlConfirm = rateLimit(`copilot-confirm:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rlConfirm.ok) {
      return NextResponse.json(
        { error: tr('Too many confirm requests - please wait a moment and try again.', 'Trop de confirmations - attendez un moment et réessayez.') },
        { status: 429 }
      );
    }
    return handleConfirm(
      businessId,
      asConfirm.data.preview,
      asConfirm.data.idempotencyKey,
      fr
    );
  }

  // Quote confirm carries previewType: 'quote'. The three confirm schemas
  // are disjoint by their previewType literal, so a quote payload can never
  // be mistaken for a job confirm (the job schema requires literal 'job').
  const asQuoteConfirm = quoteConfirmSchema.safeParse(body);
  if (asQuoteConfirm.success) {
    const rlConfirm = rateLimit(`copilot-confirm:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rlConfirm.ok) {
      return NextResponse.json(
        { error: tr('Too many confirm requests - please wait a moment and try again.', 'Trop de confirmations - attendez un moment et réessayez.') },
        { status: 429 }
      );
    }
    return handleQuoteConfirm(
      businessId,
      asQuoteConfirm.data.preview,
      asQuoteConfirm.data.idempotencyKey,
      fr
    );
  }

  // --- Normal chat message --------------------------------------------------
  const asMessage = messageSchema.safeParse(body);
  if (!asMessage.success) {
    // Name the actual failure: a confirm payload that failed validation and
    // an over-long message used to get the "empty message" error too, which
    // sent users debugging the wrong thing (2026-10-21 QA).
    const b = body as { confirm?: unknown; message?: unknown } | null;
    if (b && b.confirm === true) {
      return NextResponse.json(
        { error: tr('That confirmation didn\'t validate - please re-open the preview and try again.', 'Cette confirmation n\'a pas été validée - rouvrez l\'aperçu et réessayez.') },
        { status: 400 }
      );
    }
    if (b && typeof b.message === 'string' && b.message.length > 2000) {
      return NextResponse.json(
        { error: tr('That message is too long - please shorten it and try again.', 'Ce message est trop long - raccourcissez-le et réessayez.') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: tr('Send a message - an empty message won\'t work.', 'Envoyez un message - un message vide ne fonctionne pas.') }, { status: 400 });
  }

  // A DB/engine failure must surface as a structured JSON error, not an
  // unhandled 500 HTML page the widget cannot parse (2026-10-21 QA).
  let result: Awaited<ReturnType<typeof runCopilot>>;
  try {
    result = await runCopilot(
      businessId,
      session.user.id,
      asMessage.data.message,
      (asMessage.data.history ?? []) as CopilotHistoryItem[],
      { locale: fr ? 'fr' : 'en' }
    );
  } catch (err) {
    console.error('[copilot] runCopilot failed', err);
    return NextResponse.json(
      { error: tr('Something went wrong on my side - please try again in a moment.', 'Un problème est survenu de mon côté - réessayez dans un instant.') },
      { status: 500 }
    );
  }

  // B13.6: tool-call logging - every copilot invocation is audited (intent,
  // never the raw message which may hold PII).
  try {
    const { writeAuditEvent } = await import('@/lib/audit');
    await writeAuditEvent(prisma, {
      businessId,
      actorType: 'USER',
      actorId: session.user.id,
      action: 'COPILOT_ACTION',
      entityType: 'copilot',
      entityId: result.intent,
    });
  } catch {
    // Audit failure must not break the reply.
  }

  // Optional LLM polish: grounded on the engine's real data. Falls back silently.
  let reply = result.reply;
  if (process.env.ANTHROPIC_API_KEY) {
    const llm = await tryAnthropicReply(asMessage.data.message, {
      intent: result.intent,
      dataSummary: summarizeResult(result),
      preview: result.preview,
      uiLocale: fr ? 'fr' : 'en',
    });
    if (llm) reply = llm;
  }

  return NextResponse.json({
    reply,
    intent: result.intent,
    // draft_quote carries a preview too: the widget only renders the
    // preview card when needsConfirm is true, and omitting draft_quote
    // here silently dropped every quote draft (2026-11-08 deep test: the
    // reply suggested a price but no card ever rendered).
    needsConfirm:
      (result.intent === 'create_job' ||
        result.intent === 'create_customer' ||
        result.intent === 'draft_quote') &&
      !!result.preview,
    previewKind: result.previewKind ?? (result.intent === 'create_job' ? 'job' : null),
    preview: result.preview ?? null,
  });
}

function summarizeResult(result: { intent: string; reply: string; data?: Record<string, unknown>; preview?: JobDraft | CustomerDraft | QuoteDraft }): string {
  // The engine reply already contains only real data; pass it through as grounding.
  return result.reply;
}

// ---------------------------------------------------------------------------
// Confirm idempotency.
//
// Double-taps, retries and network replays must never create two jobs for one
// confirmed booking. Confirm-once is enforced in two layers:
//
//  1. In-memory key store (this process): the idempotency key maps to the
//     in-flight promise while creation runs, and to the settled result for
//     CONFIRM_RESULT_TTL_MS afterwards. Concurrent replays await the first
//     confirm and get the ORIGINAL job back.
//  2. Database fallback (survives restarts): before creating, look for a
//     copilot-created job with identical business/customer/title/date/time/
//     price created within the last DUPLICATE_WINDOW_MS. A replay that lands
//     after a restart still resolves to the original job.
//
// The key is client-generated (one per booking preview) when supplied,
// otherwise a deterministic sha256 of business + normalized draft details.
// ---------------------------------------------------------------------------

const CONFIRM_RESULT_TTL_MS = 30 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

type ConfirmOutcome =
  | { ok: true; jobId: string; reply: string; duplicate: boolean }
  | { ok: false; status: number; error: string };

type ConfirmEntry = {
  /** Set while creation is running; concurrent replays await this. */
  promise: Promise<ConfirmOutcome> | null;
  /** Settled outcome; replays within the TTL get the original job back. */
  outcome: ConfirmOutcome | null;
  expiresAt: number;
};

const confirmStore = new Map<string, ConfirmEntry>();

function deterministicKey(
  businessId: string,
  draft: z.infer<typeof confirmSchema>['preview']
): string {
  const canonical = [
    businessId,
    draft.title.trim().toLowerCase(),
    draft.date,
    draft.time ?? '',
    draft.customerName.trim().toLowerCase(),
    draft.phone ?? '',
    (draft.address ?? '').trim().toLowerCase(),
    String(draft.price ?? ''),
  ].join('|');
  return `det:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

function getConfirmEntry(key: string): ConfirmEntry | null {
  const entry = confirmStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    confirmStore.delete(key);
    return null;
  }
  return entry;
}

function confirmResponse(outcome: ConfirmOutcome, key: string, intent: 'create_job' | 'create_quote' = 'create_job') {
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({
    reply: outcome.reply,
    intent,
    created: true,
    jobId: outcome.jobId,
    duplicate: outcome.duplicate,
    idempotencyKey: key,
  });
}

async function handleConfirm(
  businessId: string,
  draft: z.infer<typeof confirmSchema>['preview'],
  clientKey: string | undefined,
  fr: boolean
) {
  const tr = (en: string, frText: string) => (fr ? frText : en);
  const key = clientKey?.trim() ? `cli:${clientKey.trim()}` : deterministicKey(businessId, draft);

  // Replay of an in-flight or recently completed confirm → original job.
  const existing = getConfirmEntry(key);
  if (existing?.promise) {
    return confirmResponse(await existing.promise, key);
  }
  if (existing?.outcome?.ok) {
    return confirmResponse({ ...existing.outcome, duplicate: true }, key);
  }
  if (existing?.outcome && !existing.outcome.ok) {
    // A previous attempt failed - allow a fresh try.
    confirmStore.delete(key);
  }

  // Register the in-flight promise SYNCHRONOUSLY (before any await) so that
  // concurrent confirms carrying the same key collapse onto this single run.
  let resolveOutcome!: (o: ConfirmOutcome) => void;
  const promise = new Promise<ConfirmOutcome>((resolve) => {
    resolveOutcome = resolve;
  });
  confirmStore.set(key, {
    promise,
    outcome: null,
    expiresAt: Date.now() + CONFIRM_RESULT_TTL_MS,
  });

  const outcome = await runConfirm(businessId, draft, fr);
  if (outcome.ok) {
    confirmStore.set(key, {
      promise: null,
      outcome,
      expiresAt: Date.now() + CONFIRM_RESULT_TTL_MS,
    });
  } else {
    // Nothing was created - drop the key so the user can retry for real.
    confirmStore.delete(key);
  }
  resolveOutcome(outcome);
  return confirmResponse(outcome, key);
}

/** Confirm a previewed new customer - same idempotency guarantees as jobs. */
async function handleCustomerConfirm(
  businessId: string,
  draft: z.infer<typeof customerConfirmSchema>['preview'],
  clientKey: string | undefined,
  fr: boolean
) {
  const tr = (en: string, frText: string) => (fr ? frText : en);
  const canonical = [
    'cust',
    businessId,
    draft.name.trim().toLowerCase(),
    draft.phone ?? '',
  ].join('|');
  const key = clientKey?.trim()
    ? `cli:${clientKey.trim()}`
    : `det:${crypto.createHash('sha256').update(canonical).digest('hex')}`;

  const existing = getConfirmEntry(key);
  if (existing?.promise) {
    return confirmResponse(await existing.promise, key);
  }
  if (existing?.outcome?.ok) {
    return confirmResponse({ ...existing.outcome, duplicate: true }, key);
  }
  if (existing?.outcome && !existing.outcome.ok) {
    confirmStore.delete(key);
  }

  let resolveOutcome!: (o: ConfirmOutcome) => void;
  const promise = new Promise<ConfirmOutcome>((resolve) => {
    resolveOutcome = resolve;
  });
  confirmStore.set(key, {
    promise,
    outcome: null,
    expiresAt: Date.now() + CONFIRM_RESULT_TTL_MS,
  });

  const outcome = await runCustomerConfirm(businessId, draft, fr);
  if (outcome.ok) {
    confirmStore.set(key, { promise: null, outcome, expiresAt: Date.now() + CONFIRM_RESULT_TTL_MS });
  } else {
    confirmStore.delete(key);
  }
  resolveOutcome(outcome);
  return confirmResponse(outcome, key);
}

async function runCustomerConfirm(
  businessId: string,
  draft: z.infer<typeof customerConfirmSchema>['preview'],
  fr: boolean
): Promise<ConfirmOutcome> {
  const tr = (en: string, frText: string) => (fr ? frText : en);
  const name = draft.name.trim();

  // Re-check duplicates at confirm time (tenant-scoped): an exact name or
  // phone match resolves to the existing customer - never a duplicate.
  if (draft.phone) {
    const byPhone = await prisma.customer.findFirst({
      where: { businessId, phone: { contains: draft.phone } },
      select: { id: true, name: true },
    });
    if (byPhone) {
      return {
        ok: true,
        jobId: byPhone.id,
        reply: tr(
          `"${byPhone.name}" is already in your customers - no duplicate added.`,
          `« ${byPhone.name} » est déjà dans vos clients - aucun doublon ajouté.`
        ),
        duplicate: true,
      };
    }
  }
  const candidates = await prisma.customer.findMany({
    where: { businessId, name: { contains: name } },
    select: { id: true, name: true },
    take: 5,
  });
  const exact = candidates.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
  if (exact) {
    return {
      ok: true,
      jobId: exact.id,
      reply: tr(
        `"${exact.name}" is already in your customers - no duplicate added.`,
        `« ${exact.name} » est déjà dans vos clients - aucun doublon ajouté.`
      ),
      duplicate: true,
    };
  }

  const customer = await prisma.customer.create({
    data: {
      businessId,
      name,
      phone: draft.phone ?? undefined,
      address: draft.address ?? undefined,
      notes: 'Created via EveryJob Copilot',
    },
    select: { id: true, name: true },
  });

  return {
    ok: true,
    jobId: customer.id,
    reply: tr(
      `Customer added ✓\n\n${customer.name}${draft.phone ? ` - ${draft.phone}` : ''}\n\nYou’ll find them on the Customers page.`,
      `Client ajouté ✓\n\n${customer.name}${draft.phone ? ` - ${draft.phone}` : ''}\n\nVous le trouverez sur la page Clients.`
    ),
    duplicate: false,
  };
}

/** Confirm a previewed quote draft - same idempotency guarantees as jobs. */
async function handleQuoteConfirm(
  businessId: string,
  draft: z.infer<typeof quoteConfirmSchema>['preview'],
  clientKey: string | undefined,
  fr: boolean
) {
  const canonical = [
    'quote',
    businessId,
    draft.title.trim().toLowerCase(),
    draft.customerName.trim().toLowerCase(),
    String(draft.price ?? ''),
  ].join('|');
  const key = clientKey?.trim()
    ? `cli:${clientKey.trim()}`
    : `det:${crypto.createHash('sha256').update(canonical).digest('hex')}`;

  const existing = getConfirmEntry(key);
  if (existing?.promise) {
    return confirmResponse(await existing.promise, key, 'create_quote');
  }
  if (existing?.outcome?.ok) {
    return confirmResponse({ ...existing.outcome, duplicate: true }, key, 'create_quote');
  }
  if (existing?.outcome && !existing.outcome.ok) {
    confirmStore.delete(key);
  }

  let resolveOutcome!: (o: ConfirmOutcome) => void;
  const promise = new Promise<ConfirmOutcome>((resolve) => {
    resolveOutcome = resolve;
  });
  confirmStore.set(key, {
    promise,
    outcome: null,
    expiresAt: Date.now() + CONFIRM_RESULT_TTL_MS,
  });

  const outcome = await runQuoteConfirm(businessId, draft, fr);
  if (outcome.ok) {
    confirmStore.set(key, { promise: null, outcome, expiresAt: Date.now() + CONFIRM_RESULT_TTL_MS });
  } else {
    confirmStore.delete(key);
  }
  resolveOutcome(outcome);
  return confirmResponse(outcome, key, 'create_quote');
}

async function runQuoteConfirm(
  businessId: string,
  draft: z.infer<typeof quoteConfirmSchema>['preview'],
  fr: boolean
): Promise<ConfirmOutcome> {
  const tr = (en: string, frText: string) => (fr ? frText : en);
  const title = draft.title.trim();
  const price = draft.price ?? null;
  if (price === null) {
    return { ok: false, status: 400, error: tr('Add a price to the quote first.', 'Ajoutez un prix au devis d’abord.') };
  }

  // A quote needs an EXISTING customer - never auto-create one from a draft
  // (a quote is a priced offer; inventing its recipient would be worse
  // than refusing). Exact name match only, same as job confirms.
  const candidates = await findCustomerNameCandidates(prisma, businessId, draft.customerName);
  const customer = exactNameMatch(candidates, draft.customerName);
  if (!customer) {
    return {
      ok: false,
      status: 400,
      error: tr(
        `"${draft.customerName.trim()}" isn't in your customers yet - add them first, then confirm the quote.`,
        `« ${draft.customerName.trim()} » ne figure pas encore dans vos clients - ajoutez-le d’abord, puis confirmez le devis.`
      ),
    };
  }

  // Server-side money math - same tax engine as the quote form: one line
  // item at the draft price, tax from the business's region settings.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { regionCode: true, taxRegion: true },
  });
  const taxConfig = getTaxConfig(business?.regionCode, business?.taxRegion);
  const totals = computeQuoteTotals(
    [{ qty: 1, unitPrice: price }],
    { type: null, value: null },
    taxConfig.taxes
  );

  // Idempotency DB fallback: an identical copilot quote created moments ago
  // resolves to the original - never a duplicate.
  const recent = await prisma.quote.findFirst({
    where: {
      businessId,
      customerId: customer.id,
      title,
      totalCents: dollarsToCents(totals.total) ?? BigInt(0),
      status: 'DRAFT',
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true },
  });
  if (recent) {
    return {
      ok: true,
      jobId: recent.id,
      reply: tr(
        `Quote ${recent.number} already created ✓\n\n${title} - ${customer.name} - ${formatMoney(totals.total, 'CAD')}\n\nYou'll find it on the Quotes page.`,
        `Devis ${recent.number} déjà créé ✓\n\n${title} - ${customer.name} - ${formatMoney(totals.total, 'CAD')}\n\nVous le trouverez sur la page Devis.`
      ),
      duplicate: true,
    };
  }

  const quote = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, businessId, 'QUOTE');
    const q = await tx.quote.create({
      data: {
        number,
        title,
        totalCents: dollarsToCents(totals.total) ?? BigInt(0),
        discountType: null,
        discountValue: null,
        discountValueCents: null,
        depositAmountCents: null,
        expiresAt: null,
        status: 'DRAFT',
        customerId: customer.id,
        businessId,
      },
    });
    await tx.quoteLineItem.createMany({
      data: [
        {
          quoteId: q.id,
          description: title,
          qty: 1,
          unitPriceCents: dollarsToCents(price) ?? BigInt(0),
          unitCostCents: null,
          position: 0,
        },
      ],
    });
    return q;
  });

  return {
    ok: true,
    jobId: quote.id,
    reply: tr(
      `Quote created ✓\n\n${quote.number} - ${title} - ${customer.name} - ${formatMoney(totals.total, 'CAD')}\n\nYou'll find it on the Quotes page.`,
      `Devis créé ✓\n\n${quote.number} - ${title} - ${customer.name} - ${formatMoney(totals.total, 'CAD')}\n\nVous le trouverez sur la page Devis.`
    ),
    duplicate: false,
  };
}

/** The actual confirm work: validate, find/create customer, create the job. */
async function runConfirm(
  businessId: string,
  draft: z.infer<typeof confirmSchema>['preview'],
  fr: boolean
): Promise<ConfirmOutcome> {
  const tr = (en: string, frText: string) => (fr ? frText : en);
  // Re-validate the date is a real calendar date
  const [y, m, d] = draft.date.split('-').map(Number);
  const date = new Date(y, m - 1, d, 9, 0, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, status: 400, error: tr('Couldn\'t understand the date - please try again.', 'Date non comprise - veuillez réessayer.') };
  }

  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = 'CAD';

  // Find or create the customer (tenant-scoped)
  let customer = null as null | { id: string; name: string };
  if (draft.phone) {
    customer = await prisma.customer.findFirst({
      where: { businessId, phone: { contains: draft.phone } },
      select: { id: true, name: true },
    });
  }
  if (!customer) {
    // Case-insensitive EXACT name match only: fetch candidates
    // case-insensitively, then compare in JS. Never attach a job to a
    // partial-name customer. (2026-10-10 QA: a case-only name difference
    // returned zero candidates and the confirm created a duplicate.)
    const candidates = await findCustomerNameCandidates(prisma, businessId, draft.customerName);
    customer = exactNameMatch(candidates, draft.customerName);
  }
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        businessId,
        name: draft.customerName,
        phone: draft.phone ?? undefined,
        address: draft.address ?? undefined,
        notes: 'Created via EveryJob Copilot',
      },
      select: { id: true, name: true },
    });
  }

  // Defensive: creation must have succeeded by now.
  const bookedCustomer: { id: string; name: string } | null = customer;
  if (!bookedCustomer) {
    return { ok: false, status: 500, error: tr('Couldn\'t save the customer - please try again.', 'Impossible d\'enregistrer le client - veuillez réessayer.') };
  }

  // Idempotency DB fallback: an identical copilot booking created moments ago
  // (e.g. the first confirm succeeded but the response was lost, or the
  // server restarted) resolves to the original job - never a duplicate.
  const recent = await prisma.job.findFirst({
    where: {
      businessId,
      customerId: bookedCustomer.id,
      title: draft.title,
      date,
      // A missing time is stored as NULL (never the display string "TBD").
      time: draft.time ?? null,
      priceCents: dollarsToCents(draft.price) ?? BigInt(0),
      notes: 'Created via EveryJob Copilot',
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (recent) {
    return {
      ok: true,
      jobId: recent.id,
      reply: buildConfirmReply(draft, bookedCustomer.name, true, currency, fr),
      duplicate: true,
    };
  }

  const job = await prisma.job.create({
    data: {
      businessId,
      customerId: bookedCustomer.id,
      title: draft.title,
      date,
      // Store NULL when no time was parsed - "TBD" is display text, not data.
      time: draft.time ?? null,
      address: draft.address ?? undefined,
      priceCents: dollarsToCents(draft.price) ?? BigInt(0),
      status: 'SCHEDULED',
      notes: 'Created via EveryJob Copilot',
    },
  });

  return {
    ok: true,
    jobId: job.id,
    reply: buildConfirmReply(draft, bookedCustomer.name, false, currency, fr),
    duplicate: false,
  };
}

