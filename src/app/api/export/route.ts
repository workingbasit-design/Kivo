import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { buildExportCsv, EXPORT_TYPES, type ExportType } from '@/lib/export';

const VALID = new Set<string>(EXPORT_TYPES.map((t) => t.value));

/**
 * GET /api/export?type=customers — downloads a tenant-scoped CSV.
 * Auth required; rate-limited; origin-checked. The origin check blocks
 * forced cross-origin downloads (e.g. an attacker framing the URL on a
 * malicious page) — a mismatched Origin/Referer is never legitimate here.
 */
export async function GET(req: Request) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden(originCheck.reason);

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`export:${session.user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? '';
  if (!VALID.has(type)) {
    return NextResponse.json({ error: 'Invalid export type.' }, { status: 400 });
  }

  const csvText = await buildExportCsv(businessId, type as ExportType);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csvText, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="everyjob-${type}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
