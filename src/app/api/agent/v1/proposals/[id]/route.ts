/**
 * GET /api/agent/v1/proposals/[id]?token=
 *
 * Check a proposal's status. The token returned at creation is required —
 * unknown ids and wrong tokens both return 404 so proposals can't be
 * enumerated. Lazily marks pending proposals as expired past their
 * expiry (the purge cron cleans them up).
 */
import { NextResponse } from 'next/server';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { AGENT_PROTOCOL_VERSION, PROPOSAL_STATUS, isProposalExpired } from '@/lib/agent-protocol';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token') ?? '';

  const proposal = await unsafeUnscoped('agent:proposal:status', (db) =>
    db.agentProposal.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        agentName: true,
        service: true,
        expiresAt: true,
        decidedAt: true,
        quoteRequestId: true,
        confirmToken: true,
        business: { select: { name: true, bookingPage: { select: { slug: true } } } },
      },
    })
  );
  if (!proposal || proposal.confirmToken !== token) {
    return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
  }

  let status = proposal.status;
  if (status === PROPOSAL_STATUS.PENDING && isProposalExpired(proposal.expiresAt)) {
    status = PROPOSAL_STATUS.EXPIRED;
    await unsafeUnscoped('agent:proposal:markExpired', (db) =>
      db.agentProposal.update({
        where: { id: proposal.id },
        data: { status: PROPOSAL_STATUS.EXPIRED, decidedAt: new Date() },
      })
    );
  }

  return NextResponse.json({
    protocol: 'everyjob-agent',
    version: AGENT_PROTOCOL_VERSION,
    proposal: {
      id: proposal.id,
      status,
      agentName: proposal.agentName,
      businessName: proposal.business.name,
      businessSlug: proposal.business.bookingPage?.slug ?? null,
      service: proposal.service,
      expiresAt: proposal.expiresAt.toISOString(),
      decidedAt: proposal.decidedAt?.toISOString() ?? null,
      quoteRequestId: proposal.quoteRequestId,
    },
  });
}
