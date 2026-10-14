import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { revokeTokens } from '@/lib/quickbooks';
import { decryptSecret } from '@/lib/crypto';

/**
 * POST /api/integrations/quickbooks/disconnect - drop the business's
 * QuickBooks connection. Best-effort token revocation at Intuit, then the
 * local row is deleted regardless. The sync log is kept as the audit trail.
 */
export async function POST(req: Request) {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (!checkSameOrigin(req)) return originForbidden();

  const rl = rateLimit(`qb-disconnect:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const conn = await prisma.quickBooksConnection.findUnique({ where: { businessId } });
  if (conn && process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET) {
    // B4.2: stored tokens are encrypted - decrypt before sending to Intuit.
    await revokeTokens(decryptSecret(conn.refreshToken) ?? '', process.env.QUICKBOOKS_CLIENT_ID, process.env.QUICKBOOKS_CLIENT_SECRET);
  }
  await prisma.quickBooksConnection.deleteMany({ where: { businessId } });
  return NextResponse.json({ ok: true });
}
