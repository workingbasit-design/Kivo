import { NextResponse } from 'next/server';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { prisma } from '@/lib/prisma';

/**
 * TEMPORARY debug endpoint (2026-09-28). Returns the actual error from the
 * token-page query path so we can diagnose the production 500s. DELETE AFTER.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('key') !== 'dbg-token-500') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const out: Record<string, unknown> = {};
  try {
    const rec = await unsafeUnscoped('debug:token-test', () =>
      prisma.signatureRequest.findFirst({
        where: { id: 'nonexistent' },
        select: { id: true },
      })
    );
    out.queryOk = true;
    out.rec = rec;
  } catch (e) {
    out.queryOk = false;
    out.errorName = (e as Error)?.name;
    out.errorMessage = (e as Error)?.message?.slice(0, 500);
  }
  // Check the globalThis store state
  const g = globalThis as unknown as Record<string, unknown>;
  out.hasGlobalStore = !!g.__everyjob_unscopedStore;
  return NextResponse.json(out);
}
