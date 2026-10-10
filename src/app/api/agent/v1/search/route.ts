/**
 * GET /api/agent/v1/search?service=&city=&limit=
 *
 * Public directory search for AI agents. Returns verified, opted-in pros
 * as structured JSON — no HTML scraping needed. Public and rate-limited;
 * no key required (read scope is public data).
 */
import { NextResponse } from 'next/server';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { rateLimit } from '@/lib/rate-limit';
import {
  AGENT_PROTOCOL_VERSION,
  AGENT_SEARCH_LIMIT,
  agentSearchSchema,
  gateAgentContact,
} from '@/lib/agent-protocol';
import {
  localityFromAddress,
  matchesCity,
  matchesServiceKeyword,
  publicClientIp,
  ratingSummary,
} from '@/lib/directory';

export async function GET(req: Request) {
  const ip = await publicClientIp();
  const rl = rateLimit(`agent-search:${ip}`, AGENT_SEARCH_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const url = new URL(req.url);
  const parsed = agentSearchSchema.safeParse({
    service: url.searchParams.get('service') ?? '',
    city: url.searchParams.get('city') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters.' }, { status: 400 });
  }
  const { service, city, limit } = parsed.data;
  const origin = url.origin;

  const businesses = await unsafeUnscoped('agent:search', (db) =>
    db.business.findMany({
      where: { directoryOptIn: true, directoryVerifiedAt: { not: null }, bookingPage: { is: { enabled: true } } },
      select: {
        name: true,
        phone: true,
        whatsappNumber: true,
        address: true,
        regionCode: true,
        directoryHideAddress: true,
        bookingPage: { select: { slug: true, showPhone: true } },
        services: { select: { name: true, price: true }, orderBy: { name: 'asc' }, take: 12 },
        reviews: { select: { rating: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    })
  );

  const results = businesses
    .filter(
      (b) =>
        matchesServiceKeyword(service, b.name, b.services.map((s) => s.name)) &&
        matchesCity(city, b.address)
    )
    .slice(0, limit)
    .map((b) => {
      const { count, avg } = ratingSummary(b.reviews);
      const slug = b.bookingPage!.slug;
      return {
        slug,
        name: b.name,
        locality: b.directoryHideAddress ? localityFromAddress(b.address) : b.address,
        // Respect the business's public-profile choice: a pro that hid its
        // number on the booking page must not have it (or WhatsApp, which
        // routes to the same number) exposed to anonymous agent callers.
        ...gateAgentContact(b.bookingPage!.showPhone, b.phone, b.whatsappNumber),
        regionCode: b.regionCode,
        rating: avg,
        reviewCount: count,
        services: b.services.map((s) => ({ name: s.name, price: s.price })),
        profileUrl: `${origin}/p/${slug}`,
      };
    });

  return NextResponse.json({
    protocol: 'everyjob-agent',
    version: AGENT_PROTOCOL_VERSION,
    results,
    hint: 'To request a quote, POST /api/agent/v1/proposals with the pro\'s slug. The customer must confirm via the returned confirmationUrl before anything is sent.',
  });
}
