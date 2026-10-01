/**
 * POST /api/agent/v1/proposals
 *
 * An AI agent PROPOSES a quote request on behalf of a customer. This
 * creates a PENDING proposal only — nothing is sent to the business and
 * no quote request exists until the human approves via the returned
 * confirmationUrl (/a/[token], 24h expiry).
 *
 * Auth: optional. `Authorization: Bearer ejc_agent_...` (customer agent
 * key) → identity (name/phone/email/city) is resolved from the key and
 * the agent needs the `write` scope. Anonymous agents must supply
 * customerName + customerEmail in the body.
 *
 * Headers: Idempotency-Key (required) — retries with the same key return
 * the original proposal instead of creating a duplicate.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { rateLimit } from '@/lib/rate-limit';
import {
  AGENT_PROPOSAL_LIMIT,
  AGENT_PROTOCOL_VERSION,
  IDEMPOTENCY_HEADER,
  agentProposalSchema,
  generateConfirmToken,
  isProposalExpired,
  normalizeAgentName,
  proposalExpiry,
} from '@/lib/agent-protocol';
import { customerKeyHasScope, authenticateAgentRequest } from '@/lib/customer-agent-keys';
import { publicClientIp } from '@/lib/directory';

type EligibleBusiness = { id: string; name: string; slug: string } | null;

async function resolveEligibleBusiness(
  businessSlug: string | undefined,
  businessId: string | undefined
): Promise<EligibleBusiness> {
  if (businessSlug) {
    const page = await unsafeUnscoped('agent:proposal:bySlug', (db) =>
      db.bookingPage.findUnique({
        where: { slug: businessSlug },
        select: {
          slug: true,
          business: {
            select: { id: true, name: true, directoryOptIn: true, directoryVerifiedAt: true },
          },
        },
      })
    );
    if (!page || !page.business.directoryOptIn || !page.business.directoryVerifiedAt) return null;
    return { id: page.business.id, name: page.business.name, slug: page.slug };
  }
  const b = await unsafeUnscoped('agent:proposal:byId', (db) =>
    db.business.findUnique({
      where: { id: businessId! },
      select: {
        id: true,
        name: true,
        directoryOptIn: true,
        directoryVerifiedAt: true,
        bookingPage: { select: { slug: true } },
      },
    })
  );
  if (!b || !b.directoryOptIn || !b.directoryVerifiedAt || !b.bookingPage) return null;
  return { id: b.id, name: b.name, slug: b.bookingPage.slug };
}

function proposalPayload(p: {
  id: string;
  status: string;
  expiresAt: Date;
  confirmToken?: string;
  businessName: string;
  service: string;
}) {
  return {
    id: p.id,
    status: p.status,
    businessName: p.businessName,
    service: p.service,
    expiresAt: p.expiresAt.toISOString(),
  };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  // 1. Per-IP rate limit (spam-prone public endpoint).
  const ip = await publicClientIp();
  const rl = rateLimit(`agent-proposal:${ip}`, AGENT_PROPOSAL_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many proposals. Please slow down and try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // 2. Optional agent-key auth → customer identity from the key.
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.key && !customerKeyHasScope(auth.key, 'write')) {
    return NextResponse.json({ error: 'This agent key lacks permission to propose requests.' }, { status: 403 });
  }

  // 3. Idempotency key is mandatory.
  const idempotencyKey = (req.headers.get(IDEMPOTENCY_HEADER) ?? '').trim();
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return NextResponse.json(
      { error: `Send a unique ${IDEMPOTENCY_HEADER} header so retries never create duplicates.` },
      { status: 400 }
    );
  }

  // 4. Validate the body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  const parsed = agentProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid proposal.', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // 5. Resolve + revalidate the business server-side. A tampered
  //    businessId/slug for a hidden, unverified, or non-consenting
  //    business fails closed here.
  const business = await resolveEligibleBusiness(input.businessSlug, input.businessId);
  if (!business) {
    return NextResponse.json(
      { error: 'Business not found or not accepting agent quote requests.' },
      { status: 404 }
    );
  }

  // 6. Resolve the customer identity.
  let customerId: string | null = null;
  let customerName = input.customerName;
  let customerPhone = input.customerPhone || null;
  let customerEmail = input.customerEmail || null;
  let customerCity = input.city || null;
  let agentKeyId: string | null = null;
  if (auth.key) {
    const c = auth.key.customer;
    customerId = c.id;
    agentKeyId = auth.key.keyId;
    customerName = c.name?.trim() || customerName || 'Customer';
    customerPhone = c.phone || customerPhone;
    customerEmail = c.email || customerEmail;
    customerCity = c.city || customerCity;
  } else {
    if (!customerEmail || !customerName) {
      return NextResponse.json(
        { error: 'Anonymous proposals require customerName and customerEmail so the pro can respond.' },
        { status: 400 }
      );
    }
  }
  const agentName = normalizeAgentName(input.agentName);

  // 7. Idempotent replay: same key → the original proposal, never a duplicate.
  const existing = await unsafeUnscoped('agent:proposal:dedupe', (db) =>
    db.agentProposal.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true, expiresAt: true, confirmToken: true, service: true },
    })
  );
  if (existing) {
    if (!isProposalExpired(existing.expiresAt)) {
      return NextResponse.json({
        protocol: 'everyjob-agent',
        version: AGENT_PROTOCOL_VERSION,
        deduplicated: true,
        proposal: proposalPayload({ ...existing, businessName: business.name }),
        confirmationUrl: `${origin}/a/${existing.confirmToken}`,
        token: existing.confirmToken,
        message: 'A proposal with this idempotency key already exists. Nothing was duplicated.',
      });
    }
    // The key was seen before but that proposal is over (expired or
    // decided). Replaying it must NOT silently create a new proposal
    // under the same key, and must NOT 500 on the unique constraint —
    // the agent needs a fresh Idempotency-Key.
    return NextResponse.json(
      {
        error:
          'This Idempotency-Key was already used for a proposal that is no longer pending. Send a new Idempotency-Key to create a new proposal.',
        code: 'idempotency_key_retired',
      },
      { status: 410 }
    );
  }

  // 8. Create the PENDING proposal. Nothing reaches the business yet.
  const confirmToken = generateConfirmToken();
  const proposal = await prisma.agentProposal.create({
    data: {
      idempotencyKey,
      agentName,
      agentKeyId,
      businessId: business.id,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerCity,
      service: input.service,
      description: input.description,
      status: 'pending',
      confirmToken,
      expiresAt: proposalExpiry(),
    },
    select: { id: true, status: true, expiresAt: true, service: true },
  });

  return NextResponse.json(
    {
      protocol: 'everyjob-agent',
      version: AGENT_PROTOCOL_VERSION,
      proposal: proposalPayload({ ...proposal, businessName: business.name }),
      confirmationUrl: `${origin}/a/${confirmToken}`,
      token: confirmToken,
      message:
        'Proposal created and PENDING. Share the confirmationUrl with the customer — the quote request is sent to the business only after they tap Approve (link expires in 24 hours).',
    },
    { status: 201 }
  );
}
