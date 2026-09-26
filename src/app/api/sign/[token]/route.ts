import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  resolveSignatureRequest,
  submitSignature,
} from '@/lib/esign';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFromHeaders } from '@/lib/client-ip';

/**
 * POST /api/sign/[token] — submit a client signature for a signing link.
 * Never distinguishes failure reasons: unknown, expired, revoked, and
 * validation failures all surface as the same generic error.
 */

const SIGN_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpFromHeaders(h);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = rateLimit(`sign:${await clientIp()}`, SIGN_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'failed' }, { status: 429 });
  }

  const { token } = await params;
  const resolved = await resolveSignatureRequest(token);
  if (!resolved) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 400 });
  }

  const { signerName, signatureData } = (body ?? {}) as {
    signerName?: unknown;
    signatureData?: unknown;
  };

  if (
    typeof signerName !== 'string' ||
    signerName.trim().length < 1 ||
    signerName.length > 100 ||
    typeof signatureData !== 'string' ||
    signatureData.length < 10 ||
    signatureData.length > 500000 ||
    (!signatureData.startsWith('data:image/') && !signatureData.startsWith('typed:'))
  ) {
    return NextResponse.json({ error: 'failed' }, { status: 400 });
  }

  try {
    await submitSignature(resolved.id, resolved.businessId, {
      signerName: signerName.trim(),
      signatureData,
    });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
