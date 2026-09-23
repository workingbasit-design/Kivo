import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { runCopilot, type JobDraft, type CopilotHistoryItem } from '@/lib/copilot/engine';
import { tryAnthropicReply } from '@/lib/copilot/anthropic';
import { formatDateShort } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { getLocale } from '@/lib/i18n/server';

export const maxDuration = 30;

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
  preview: z.object({
    title: z.string().min(1).max(120),
    date: strictDate,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    customerName: z.string().min(1).max(80),
    phone: z.string().regex(/^[2-9]\d{9}$/).nullable().optional(), // NANP 10-digit
    address: z.string().max(200).nullable().optional(),
    price: z.number().int().min(0).max(10000000).nullable().optional(),
  }),
  // Client-generated idempotency key (one per booking preview). Optional —
  // when absent the server derives a deterministic key from the draft.
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

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const fr = (await getLocale()) === 'fr';
  const tr = (en: string, frText: string) => (fr ? frText : en);

  // Rate limit: 30 copilot calls/min per user
  const rl = rateLimit(`copilot:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: tr('Too many requests — please wait a moment and try again.', 'Trop de requêtes — attendez un moment et réessayez.') },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // --- Confirm a previously previewed job ---------------------------------
  const asConfirm = confirmSchema.safeParse(body);
  if (asConfirm.success) {
    // Job creation is higher-stakes than chat: tighter per-user budget.
    const rlConfirm = rateLimit(`copilot-confirm:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rlConfirm.ok) {
      return NextResponse.json(
        { error: tr('Too many confirm requests — please wait a moment and try again.', 'Trop de confirmations — attendez un moment et réessayez.') },
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

  // --- Normal chat message --------------------------------------------------
  const asMessage = messageSchema.safeParse(body);
  if (!asMessage.success) {
    return NextResponse.json({ error: tr('Send a message — an empty message won\'t work.', 'Envoyez un message — un message vide ne fonctionne pas.') }, { status: 400 });
  }

  const result = await runCopilot(
    businessId,
    session.user.id,
    asMessage.data.message,
    (asMessage.data.history ?? []) as CopilotHistoryItem[],
    { locale: fr ? 'fr' : 'en' }
  );

  // Optional LLM polish: grounded on the engine's real data. Falls back silently.
  let reply = result.reply;
  if (process.env.ANTHROPIC_API_KEY) {
    const llm = await tryAnthropicReply(asMessage.data.message, {
      intent: result.intent,
      dataSummary: summarizeResult(result),
      preview: result.preview,
    });
    if (llm) reply = llm;
  }

  return NextResponse.json({
    reply,
    intent: result.intent,
    needsConfirm: result.intent === 'create_job' && !!result.preview,
    preview: result.preview ?? null,
  });
}

function summarizeResult(result: { intent: string; reply: string; data?: Record<string, unknown>; preview?: JobDraft }): string {
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

function confirmResponse(outcome: ConfirmOutcome, key: string) {
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({
    reply: outcome.reply,
    intent: 'create_job',
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
    // A previous attempt failed — allow a fresh try.
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
    // Nothing was created — drop the key so the user can retry for real.
    confirmStore.delete(key);
  }
  resolveOutcome(outcome);
  return confirmResponse(outcome, key);
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
    return { ok: false, status: 400, error: tr('Couldn\'t understand the date — please try again.', 'Date non comprise — veuillez réessayer.') };
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
    // Case-insensitive EXACT name match only: fetch contains-candidates and
    // compare in JS. Never attach a job to a partial-name customer.
    const candidates = await prisma.customer.findMany({
      where: { businessId, name: { contains: draft.customerName } },
      select: { id: true, name: true },
      take: 5,
    });
    const wanted = draft.customerName.trim().toLowerCase();
    customer = candidates.find((c) => c.name.trim().toLowerCase() === wanted) ?? null;
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
    return { ok: false, status: 500, error: tr('Couldn\'t save the customer — please try again.', 'Impossible d\'enregistrer le client — veuillez réessayer.') };
  }

  // Idempotency DB fallback: an identical copilot booking created moments ago
  // (e.g. the first confirm succeeded but the response was lost, or the
  // server restarted) resolves to the original job — never a duplicate.
  const recent = await prisma.job.findFirst({
    where: {
      businessId,
      customerId: bookedCustomer.id,
      title: draft.title,
      date,
      // A missing time is stored as NULL (never the display string "TBD").
      time: draft.time ?? null,
      price: draft.price ?? 0,
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
      reply: buildConfirmReply(draft, bookedCustomer.name, true, currency),
      duplicate: true,
    };
  }

  const job = await prisma.job.create({
    data: {
      businessId,
      customerId: bookedCustomer.id,
      title: draft.title,
      date,
      // Store NULL when no time was parsed — "TBD" is display text, not data.
      time: draft.time ?? null,
      address: draft.address ?? undefined,
      price: draft.price ?? 0,
      status: 'SCHEDULED',
      notes: 'Created via EveryJob Copilot',
    },
  });

  return {
    ok: true,
    jobId: job.id,
    reply: buildConfirmReply(draft, bookedCustomer.name, false, currency),
    duplicate: false,
  };
}

function buildConfirmReply(
  draft: z.infer<typeof confirmSchema>['preview'],
  customerName: string,
  duplicate: boolean,
  currency: string
): string {
  return (
    (duplicate
      ? 'Yeh booking pehle hi confirm ho chuki hai — duplicate job nahi banayi.\n\n'
      : 'Job book ho gayi! ✓\n\n') +
    `${draft.title} — ${customerName}\n` +
    `${formatDateShort(draft.date)}${draft.time ? `, ${draft.time}` : ''}\n` +
    `Price: ${draft.price !== null && draft.price !== undefined ? formatMoney(draft.price, currency) : 'TBD'}\n\n` +
    `Schedule mein dekh sakte ho.`
  );
}
