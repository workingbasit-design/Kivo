/**
 * Cron: purge old agent proposals.
 *
 * AgentProposal rows are short-lived by design (24h confirmation window).
 * Terminal rows (expired / declined) are kept for 30 days so the
 * confirmation page and the agent's status poll keep answering honestly,
 * then deleted. Approved proposals are retained indefinitely as the audit
 * trail of executed actions (they point at the quote request they made).
 *
 * Auth: same CRON_SECRET pattern as the other cron routes.
 */
import { NextResponse } from 'next/server';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { PROPOSAL_STATUS } from '@/lib/agent-protocol';

export const maxDuration = 60;

/** Terminal (non-approved) proposals are purged 30 days after decision. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }
  const url = new URL(req.url);
  const provided =
    url.searchParams.get('secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const deleted = await unsafeUnscoped('cron:agent-purge', (db) =>
    db.agentProposal.deleteMany({
      where: {
        status: { in: [PROPOSAL_STATUS.EXPIRED, PROPOSAL_STATUS.DECLINED] },
        OR: [{ decidedAt: { lt: cutoff } }, { decidedAt: null, expiresAt: { lt: cutoff } }],
      },
    })
  );
  return NextResponse.json({ ok: true, purged: deleted.count });
}
