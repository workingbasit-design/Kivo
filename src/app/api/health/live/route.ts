import { NextResponse } from 'next/server';

/**
 * Lightweight liveness probe for load balancers (book layer 14b).
 * Confirms the process is up; use /api/health for dependency checks.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
