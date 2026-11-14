/**
 * In-memory stand-in for the modules
 * src/app/api/agent/v1/search/route.ts touches, for the GET
 * /api/agent/v1/search endpoint tests (DB-audit m7).
 *
 * - next/server: minimal NextResponse.json
 * - next/headers: headers() returns empty Headers (publicClientIp falls
 *   back to 'unknown'; the real in-memory rate limiter is used)
 * - @/lib/prisma: business.findMany with call capture + a small evaluator
 *   for the where shapes buildAgentSearchWhere() produces (AND/OR,
 *   contains+insensitive, services.some, directoryOptIn,
 *   directoryVerifiedAt not-null, bookingPage.is.enabled), so the route
 *   test proves the DB-side filter actually filters the response.
 *
 * Also registered as the tenant-guard's unscoped client so
 * unsafeUnscoped() resolves against the stub instead of a real database.
 */
import { setUnscopedClient } from '../tenant-guard.ts';

export const calls = {
  businessFindMany: [],
};

const DB = {
  businesses: [
    {
      name: 'Harbour Clean Co',
      phone: '4165550101',
      whatsappNumber: null,
      address: '5 Front St W, Toronto, ON M5J 1C7',
      regionCode: 'ON',
      directoryHideAddress: false,
      directoryOptIn: true,
      directoryVerifiedAt: '2026-01-01T00:00:00.000Z',
      bookingPage: { slug: 'harbour-clean-co', enabled: true, showPhone: true },
      services: [{ name: 'Deep Cleaning', priceCents: 12000n, active: true }],
      reviews: [],
    },
    {
      name: 'Maple Plumbing',
      phone: '4165550102',
      whatsappNumber: '4165550102',
      address: '12 Queen St E, Toronto, ON M5C 1S1',
      regionCode: 'ON',
      directoryHideAddress: false,
      directoryOptIn: true,
      directoryVerifiedAt: '2026-01-01T00:00:00.000Z',
      bookingPage: { slug: 'maple-plumbing', enabled: true, showPhone: true },
      services: [
        { name: 'Drain Cleaning', priceCents: 14900n, active: true },
        { name: 'Furnace Tune-up', priceCents: 9900n, active: true },
        { name: 'Old Boiler Service', priceCents: 19900n, active: false },
      ],
      reviews: [{ rating: 5 }, { rating: 4 }],
    },
    {
      name: 'Montreal Spark Electric',
      phone: '5145550103',
      whatsappNumber: null,
      address: '88 Rue Sainte-Catherine E, Montréal, QC H2X 1K3',
      regionCode: 'QC',
      directoryHideAddress: true,
      directoryOptIn: true,
      directoryVerifiedAt: '2026-01-01T00:00:00.000Z',
      bookingPage: { slug: 'montreal-spark-electric', enabled: true, showPhone: false },
      services: [{ name: 'Panel Upgrade', priceCents: 29900n, active: true }],
      reviews: [{ rating: 5 }],
    },
    {
      name: 'Unverified Pros',
      phone: '4165550104',
      whatsappNumber: null,
      address: '9 King St W, Toronto, ON M5H 1A1',
      regionCode: 'ON',
      directoryHideAddress: false,
      directoryOptIn: true,
      directoryVerifiedAt: null,
      bookingPage: { slug: 'unverified-pros', enabled: true, showPhone: true },
      services: [{ name: 'Drain Cleaning', priceCents: 10000n, active: true }],
      reviews: [],
    },
    {
      name: 'Booking Off Builders',
      phone: '4165550105',
      whatsappNumber: null,
      address: '77 Adelaide St W, Toronto, ON M5H 1P5',
      regionCode: 'ON',
      directoryHideAddress: false,
      directoryOptIn: true,
      directoryVerifiedAt: '2026-01-01T00:00:00.000Z',
      bookingPage: { slug: 'booking-off-builders', enabled: false, showPhone: true },
      services: [{ name: 'Deck Build', priceCents: 50000n, active: true }],
      reviews: [],
    },
  ],
};

export function resetAgentSearchStub() {
  calls.businessFindMany.length = 0;
}

function contains(hay, spec) {
  if (typeof hay !== 'string' || spec?.contains === undefined) return false;
  const q = String(spec.contains);
  return spec.mode === 'insensitive'
    ? hay.toLowerCase().includes(q.toLowerCase())
    : hay.includes(q);
}

/** Evaluate one where condition against a canned business row. */
function matchesCondition(b, cond) {
  for (const [field, spec] of Object.entries(cond)) {
    if (field === 'AND') {
      if (!spec.every((c) => matchesCondition(b, c))) return false;
      continue;
    }
    if (field === 'OR') {
      if (!spec.some((c) => matchesCondition(b, c))) return false;
      continue;
    }
    if (field === 'directoryOptIn') {
      if (b.directoryOptIn !== spec) return false;
      continue;
    }
    if (field === 'directoryVerifiedAt') {
      if (spec?.not === null && b.directoryVerifiedAt === null) return false;
      continue;
    }
    if (field === 'bookingPage') {
      if (spec?.is?.enabled !== undefined && b.bookingPage.enabled !== spec.is.enabled) return false;
      continue;
    }
    if (field === 'services' && spec?.some) {
      const some = spec.some;
      const hit = b.services.some(
        (s) =>
          (some.name === undefined || contains(s.name, some.name)) &&
          (some.active === undefined || s.active === some.active)
      );
      if (!hit) return false;
      continue;
    }
    if (spec?.contains !== undefined) {
      if (!contains(b[field], spec)) return false;
      continue;
    }
    // Unknown shape: fail closed so a builder change shows up as a test
    // failure instead of silently passing.
    throw new Error(`agent-search stub: unhandled where field ${field}`);
  }
  return true;
}

function projectBusiness(b, select) {
  const out = {};
  for (const key of Object.keys(select)) {
    if (key === 'bookingPage') {
      out.bookingPage = { slug: b.bookingPage.slug, showPhone: b.bookingPage.showPhone };
    } else if (key === 'services') {
      out.services = b.services
        .filter((s) => s.active)
        .sort((a, z) => a.name.localeCompare(z.name))
        .slice(0, 12)
        .map((s) => ({ name: s.name, priceCents: s.priceCents }));
    } else if (key === 'reviews') {
      out.reviews = b.reviews.map((r) => ({ rating: r.rating }));
    } else {
      out[key] = b[key];
    }
  }
  return out;
}

export const prisma = {
  business: {
    findMany: async (args) => {
      calls.businessFindMany.push(args);
      const rows = DB.businesses
        .filter((b) => matchesCondition(b, args.where ?? {}))
        .sort((a, z) => a.name.localeCompare(z.name))
        .slice(0, args.take ?? 10)
        .map((b) => projectBusiness(b, args.select));
      return rows;
    },
  },
};

// Register the stub prisma as the tenant-guard's unscoped client so
// unsafeUnscoped() blocks run against the in-memory stub instead of
// throwing "unscoped client not initialized".
setUnscopedClient(prisma);

export class NextResponse {
  static json(data, init) {
    const body = JSON.stringify(data);
    const res = new Response(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
    res._json = data;
    return res;
  }
}

export async function headers() {
  return new Headers();
}
