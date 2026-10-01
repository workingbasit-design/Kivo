/**
 * GET /.well-known/everyjob.json
 *
 * Machine-readable capability manifest for the EveryJob Agent Protocol.
 * This is how AI agents discover what they can do — no guessing, no
 * reverse-engineering. See https://kivo-nine-silk.vercel.app/agents
 */
import { NextResponse } from 'next/server';
import { buildAgentManifest } from '@/lib/agent-protocol';

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(buildAgentManifest(origin), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
