/**
 * Cron: purge old agent proposals.
 *
 * AgentProposal rows are short-lived by design (24h confirmation window).
 * Terminal rows (expired / declined) are kept for 30 days so the
 * confirmation page and the agent's status poll keep answering honestly,
 * then deleted. Approved proposals are retained indefinitely as the audit
 * trail of executed actions (they point at the quote request they made).
 *
 * Auth: same CRON_SECRET pattern as the other cron routes (Bearer header only; see `src/lib/cron-auth.ts`).
 */
import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { PROPOSAL_STATUS } from '@/lib/agent-protocol';

export const maxDuration = 60;

/** Terminal (non-approved) proposals are purged 30 days after decision. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

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
