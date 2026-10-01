import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY QA ENDPOINT — reports real Postgres column types for money-ish
 * columns. Guarded by a one-time token. REMOVE BEFORE FINAL RELEASE.
 */
const TOKEN = 'qa-debug-9f3a7c2e1b5d4a8f';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rows = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string; data_type: string }>
  >(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('real', 'double precision', 'numeric')
     ORDER BY table_name, column_name`
  );

  // DB-layer round-trip probe: writes 99.99 via Prisma exactly like the
  // pricebook action does, reads it back via Prisma AND via raw SQL, then
  // deletes the probe row. ?probe=1 to run.
  let probe: unknown = null;
  if (req.nextUrl.searchParams.get('probe') === '1') {
    const biz = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Business" LIMIT 1`
    );
    const businessId = biz[0].id;
    const created = await prisma.service.create({
      data: { name: 'DB Layer Probe', price: 99.99, businessId },
    });
    const viaPrisma = await prisma.service.findUnique({
      where: { id: created.id },
      select: { price: true },
    });
    const viaSql = await prisma.$queryRawUnsafe<Array<{ price: number; t: string }>>(
      `SELECT price, price::text AS t FROM "Service" WHERE id = '${created.id}'`
    );
    await prisma.service.delete({ where: { id: created.id } });
    const stillThere = await prisma.service.findUnique({ where: { id: created.id } });
    probe = {
      wrote: '99.99',
      viaPrisma: viaPrisma ? String(viaPrisma.price) : null,
      viaSqlNumber: viaSql[0] ? String(viaSql[0].price) : null,
      viaSqlText: viaSql[0] ? viaSql[0].t : null,
      deleted: stillThere === null,
    };
  }
  return NextResponse.json({ rows, probe });
}
