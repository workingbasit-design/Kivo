/**
 * GET /api/agent/v1/pros/[slug]
 *
 * Public pro profile as structured JSON for AI agents. Same tenant-safe
 * rule as the HTML profile: only verified, opted-in businesses resolve,
 * and only public-safe fields are returned.
 */
import { NextResponse } from 'next/server';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { rateLimit } from '@/lib/rate-limit';
import { AGENT_PROTOCOL_VERSION, AGENT_SEARCH_LIMIT } from '@/lib/agent-protocol';
import {
  isPhoneVerified,
  localityFromAddress,
  publicClientIp,
  ratingSummary,
} from '@/lib/directory';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ip = await publicClientIp();
  const rl = rateLimit(`agent-search:${ip}`, AGENT_SEARCH_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const { slug } = await params;
  const url = new URL(req.url);

  const page = await unsafeUnscoped('agent:proProfile', (db) =>
    db.bookingPage.findUnique({
      where: { slug },
      select: {
        headline: true,
        headlineFr: true,
        showPhone: true,
        serviceAreas: true,
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            phone: true,
            whatsappNumber: true,
            address: true,
            workingHours: true,
            regionCode: true,
            currency: true,
            directoryOptIn: true,
            directoryVerifiedAt: true,
            directoryHideAddress: true,
          },
        },
      },
    })
  );
  if (!page || !page.business.directoryOptIn || !page.business.directoryVerifiedAt) {
    return NextResponse.json({ error: 'Pro not found.' }, { status: 404 });
  }
  const b = page.business;

  const [services, reviews] = await Promise.all([
    unsafeUnscoped('agent:proServices', (db) =>
      db.service.findMany({
        where: { businessId: b.id },
        select: { name: true, price: true },
        orderBy: { name: 'asc' },
        take: 25,
      })
    ),
    unsafeUnscoped('agent:proReviews', (db) =>
      db.review.findMany({
        where: { businessId: b.id },
        select: { rating: true },
      })
    ),
  ]);
  const { count, avg } = ratingSummary(reviews);

  return NextResponse.json({
    protocol: 'everyjob-agent',
    version: AGENT_PROTOCOL_VERSION,
    pro: {
      slug,
      name: b.name,
      logoUrl: b.logoUrl,
      headline: { en: page.headline, fr: page.headlineFr },
      locality: b.directoryHideAddress ? localityFromAddress(b.address) : b.address,
      serviceAreas: page.serviceAreas,
      phone: page.showPhone ? b.phone : null,
      whatsapp: b.whatsappNumber,
      phoneVerified: isPhoneVerified(b.phone, b.whatsappNumber, b.regionCode),
      workingHours: b.workingHours,
      currency: b.currency,
      rating: avg,
      reviewCount: count,
      services: services.map((s) => ({ name: s.name, price: s.price })),
      profileUrl: `${url.origin}/p/${slug}`,
      quoteHint: `POST ${url.origin}/api/agent/v1/proposals with { "businessSlug": "${slug}", ... } to propose a quote request.`,
    },
  });
}
