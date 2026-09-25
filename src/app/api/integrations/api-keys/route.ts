/**
 * /api/integrations/api-keys — session-authenticated CRUD for tenant API
 * keys (used by Settings → Integrations).
 *
 * - GET: list keys (metadata only — the plaintext key is never readable).
 * - POST { name, scope: 'read' | 'write' }: create a key; the plaintext is
 *   returned ONCE in the response and never again.
 * - DELETE { id }: revoke a key (soft — keeps the audit trail).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { createApiKey, type ApiScope } from '@/lib/apiKeys';

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  scope: z.enum(['read', 'write']).default('read'),
});

const revokeSchema = z.object({ id: z.string().min(1) });

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
  const rl = rateLimit(`integrations-keys:${businessId}`, ACTION_LIMIT);
  return rl.ok ? null : NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
}

export async function GET(req: Request) {
  const g = guard(req);
  if (g) return g;
  const businessId = await authedBusinessId();
  if (!businessId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const keys = await prisma.apiKey.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ data: keys });
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
  const scopes: ApiScope[] = parsed.data.scope === 'write' ? ['write'] : ['read'];
  const created = await createApiKey(businessId, parsed.data.name, scopes);
  // `key` is the plaintext — returned once, never stored, never readable again.
  return NextResponse.json({ data: created }, { status: 201 });
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
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload.' }, { status: 422 });

  // Scoped update — revokes 0 rows for foreign ids.
  const res = await prisma.apiKey.updateMany({
    where: { id: parsed.data.id, businessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: 'API key not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
