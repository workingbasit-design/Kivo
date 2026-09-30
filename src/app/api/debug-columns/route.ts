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
  return NextResponse.json({ rows });
}
