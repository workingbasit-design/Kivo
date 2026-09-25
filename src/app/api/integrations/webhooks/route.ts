/**
 * /api/integrations/webhooks — session-authenticated CRUD for webhook
 * endpoints + recent delivery log (used by Settings → Integrations).
 *
 * - GET: endpoints plus the 25 most recent deliveries across them.
 * - POST { url, events }: create an endpoint; returns the signing secret
 *   ONCE (needed to verify X-EveryJob-Signature).
 * - PATCH { id, active }: pause/resume an endpoint.
 * - DELETE { id }: remove an endpoint (deliveries cascade).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { WEBHOOK_EVENTS, generateWebhookSecret, type WebhookEvent } from '@/lib/webhooks';

const idSchema = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), {
      message: 'URL must be https (localhost allowed for testing).',
    }),
  events: z
    .array(z.string())
    .min(1)
    .max(WEBHOOK_EVENTS.length)
    .refine((evts) => evts.every((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)), {
      message: 'Unknown event name.',
    }),
});

const toggleSchema = z.object({ id: z.string().min(1), active: z.boolean() });

function guard(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();
  return null;
}

async function authedBusinessId() {
  const session = await getSession();
  return session?.user?.businessId ?? null;
}

function limited(businessId: string) {
  const rl = rateLimit(`integrations-webhooks:${businessId}`, ACTION_LIMIT);
  return rl.ok ? null : NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
}

async function listData(businessId: string) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, events: true, active: true, createdAt: true },
  });
  const ids = endpoints.map((e) => e.id);
  const deliveries = ids.length
    ? await prisma.webhookDelivery.findMany({
        where: { endpointId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          endpointId: true,
          event: true,
          status: true,
          attempts: true,
          nextRetry: true,
          lastError: true,
          createdAt: true,
        },
      })
    : [];
  return { endpoints, deliveries };
}

export async function GET(req: Request) {
  const g = guard(req);
  if (g) return g;
  const businessId = await authedBusinessId();
  if (!businessId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json({ data: await listData(businessId) });
}

export async function POST(req: Request) {
  const g = guard(req);
  if (g) return g;
  const businessId = await authedBusinessId();
  if (!businessId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const l = limited(businessId);
  if (l) return l;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 422 }
    );
  }
  const secret = generateWebhookSecret();
  const created = await prisma.webhookEndpoint.create({
    data: {
      businessId,
      url: parsed.data.url,
      secret,
      events: JSON.stringify([...new Set(parsed.data.events as WebhookEvent[])]),
      active: true,
    },
    select: { id: true, url: true, events: true, active: true, createdAt: true },
  });
  // `secret` is returned once — the owner pastes it into Zapier/Make to
  // verify the X-EveryJob-Signature header.
  return NextResponse.json({ data: { ...created, secret } }, { status: 201 });
}

export async function PATCH(req: Request) {
  const g = guard(req);
  if (g) return g;
  const businessId = await authedBusinessId();
  if (!businessId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const l = limited(businessId);
  if (l) return l;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload.' }, { status: 422 });

  const res = await prisma.webhookEndpoint.updateMany({
    where: { id: parsed.data.id, businessId },
    data: { active: parsed.data.active },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: 'Endpoint not found.' }, { status: 404 });
  }
  return NextResponse.json({ data: await listData(businessId) });
}

export async function DELETE(req: Request) {
  const g = guard(req);
  if (g) return g;
  const businessId = await authedBusinessId();
  if (!businessId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const l = limited(businessId);
  if (l) return l;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload.' }, { status: 422 });

  const res = await prisma.webhookEndpoint.deleteMany({
    where: { id: parsed.data.id, businessId },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: 'Endpoint not found.' }, { status: 404 });
  }
  return NextResponse.json({ data: await listData(businessId) });
}
