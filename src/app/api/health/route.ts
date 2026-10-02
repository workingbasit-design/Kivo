import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Liveness + dependency health for monitoring (book layer 14).
 * /api/health/live (cheap, for load balancers) vs /api/health (checks DB).
 */
export async function GET() {
  const started = Date.now();
  let db: 'ok' | 'unreachable';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'ok';
  } catch {
    db = 'unreachable';
  }
  const healthy = db === 'ok';
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', db, latencyMs: Date.now() - started },
    { status: healthy ? 200 : 503 }
  );
}
