'use server';
/**
 * Server actions for the human-confirmation page (/a/[token]).
 *
 * This is where the Agent Protocol's core guarantee is enforced:
 * approveProposal is the ONLY path by which an agent proposal becomes a
 * real quote request + business lead, and it can only run from the
 * unguessable confirmation link, while the proposal is pending and
 * unexpired. The agent itself has no other way to execute anything.
 *
 * Integrity properties:
 * - Approval runs inside ONE database transaction: the proposal is
 *   re-read and claimed (pending → approved) atomically, so a double
 *   tap or a retry can never create two quote requests. Exactly one
 *   approval wins; losers see the terminal state.
 * - The business is revalidated at execution time (still opted in,
 *   verified, with a booking page). A pro that withdrew consent after
 *   the proposal was created fails closed.
 * - Lead creation is LOUD: if the business lead cannot be written, the
 *   whole transaction rolls back and the proposal stays pending for a
 *   retry. We never mark "approved" while the business sees nothing.
 * - Identity: a guest proposal whose email matches an existing customer
 *   account requires that customer to be logged in before approving —
 *   nobody can attach quote requests to someone else's account via an
 *   agent link.
 * - Decline preserves the row (status = declined) so the page, the
 *   agent's status poll, and the audit trail all agree. The purge cron
 *   removes declined/expired rows only after 30 days.
 */

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { PROPOSAL_STATUS, isProposalExpired } from '@/lib/agent-protocol';
import {
  createCustomerSession,
  getCustomerSession,
  hashCustomerPassword,
} from '@/lib/customer-auth';

class ProposalDecisionError extends Error {
  constructor(public code: 'gone' | 'ineligible') {
    super(code);
  }
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

async function getPendingProposal(token: string) {
  const proposal = await unsafeUnscoped('agent:confirm:lookup', (db) =>
    db.agentProposal.findUnique({
      where: { confirmToken: token },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            bookingPage: { select: { slug: true } },
          },
        },
      },
    })
  );
  if (!proposal) return { error: 'not-found' as const };
  if (proposal.status !== PROPOSAL_STATUS.PENDING || isProposalExpired(proposal.expiresAt)) {
    if (proposal.status === PROPOSAL_STATUS.PENDING) {
      await unsafeUnscoped('agent:confirm:expire', (db) =>
        db.agentProposal.update({
          where: { id: proposal.id },
          data: { status: PROPOSAL_STATUS.EXPIRED, decidedAt: new Date() },
        })
      );
    }
    return { error: 'expired' as const, proposal };
  }
  return { proposal };
}

/**
 * Approve: the human said yes. Everything below happens in a single
 * transaction — customer resolution, quote request + opening message,
 * business lead, and the pending → approved claim.
 */
export async function approveProposal(_prev: unknown, formData: FormData) {
  const token = String(formData.get('token') || '');
  if (!token) redirect('/a/invalid');

  const found = await getPendingProposal(token);
  if ('error' in found) redirect(`/a/${token}`);
  const proposal = found.proposal;

  // ---- Identity gate -------------------------------------------------
  // Key-based proposals already carry a verified customerId (identity came
  // from the key, never from form fields). Guest proposals that name an
  // email belonging to an existing account require that customer to be
  // logged in — otherwise anyone with the link could file requests on
  // someone else's account.
  let customerId = proposal.customerId;
  if (!customerId) {
    const email = (proposal.customerEmail || '').trim().toLowerCase();
    if (!email) return { error: 'A contact email is required to send this request.' };
    const existing = await unsafeUnscoped('agent:confirm:findCustomer', (db) =>
      db.customerUser.findUnique({ where: { email }, select: { id: true } })
    );
    if (existing) {
      let session: Awaited<ReturnType<typeof getCustomerSession>>;
      try {
        session = await getCustomerSession();
      } catch {
        return { error: 'Something went wrong. Please try again.' };
      }
      if (!session || session.customer.id !== existing.id) {
        redirect(`/customer/login?next=${encodeURIComponent(`/a/${token}`)}`);
      }
      customerId = existing.id;
    }
  }

  // ---- Atomic execution ----------------------------------------------
  try {
    await unsafeUnscoped('agent:confirm:approve', (db) =>
      db.$transaction(async (tx) => {
        // Re-read inside the transaction and claim exactly one pending,
        // unexpired proposal. Concurrent approvals serialize here: the
        // first commit wins, the rest see 'gone'.
        const p = await tx.agentProposal.findUnique({
          where: { id: proposal.id },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            businessId: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            customerCity: true,
            service: true,
            description: true,
            business: {
              select: {
                directoryOptIn: true,
                directoryVerifiedAt: true,
                bookingPage: { select: { id: true } },
              },
            },
          },
        });
        if (!p || p.status !== PROPOSAL_STATUS.PENDING || isProposalExpired(p.expiresAt)) {
          throw new ProposalDecisionError('gone');
        }
        // The pro may have withdrawn directory consent since the proposal
        // was created — revalidate before anything is sent.
        if (!p.business.directoryOptIn || !p.business.directoryVerifiedAt || !p.business.bookingPage) {
          throw new ProposalDecisionError('ineligible');
        }

        // Resolve the customer (guest find-or-create by email). A unique-
        // violation race just means someone created it first — re-read.
        let cid = customerId;
        if (!cid) {
          const email = (p.customerEmail || '').trim().toLowerCase();
          const ex = await tx.customerUser.findUnique({ where: { email }, select: { id: true } });
          if (ex) {
            cid = ex.id;
          } else {
            try {
              const created = await tx.customerUser.create({
                data: {
                  email,
                  passwordHash: `agent-unusable:${randomBytes(16).toString('hex')}`,
                  name: p.customerName || null,
                  phone: p.customerPhone,
                  city: p.customerCity,
                  agentCreatedAt: new Date(),
                },
                select: { id: true },
              });
              cid = created.id;
            } catch (e) {
              if (!isUniqueViolation(e)) throw e;
              const retry = await tx.customerUser.findUnique({
                where: { email },
                select: { id: true },
              });
              if (!retry) throw e;
              cid = retry.id;
            }
          }
        }

        // The quote request (customer's view) with the opening message.
        const quoteRequest = await tx.quoteRequest.create({
          data: {
            customerId: cid!,
            businessId: p.businessId,
            service: p.service,
            description: p.description,
            status: 'sent',
            source: 'agent',
            messages: { create: { senderType: 'customer', body: p.description } },
          },
          select: { id: true },
        });

        // The lead (pro's view). Deliberately NOT swallowed: if this
        // fails, the transaction rolls back and the proposal stays
        // pending — we never report "approved" while the business got
        // nothing.
        await tx.lead.create({
          data: {
            name: p.customerName || p.customerEmail || 'Customer',
            phone: p.customerPhone,
            email: p.customerEmail,
            details: `[${p.service}] ${p.description}`,
            status: 'NEW',
            source: 'Agent',
            businessId: p.businessId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        await tx.agentProposal.update({
          where: { id: p.id },
          data: {
            status: PROPOSAL_STATUS.APPROVED,
            quoteRequestId: quoteRequest.id,
            customerId: cid,
            decidedAt: new Date(),
          },
        });
      })
    );
  } catch (e) {
    if (e instanceof ProposalDecisionError) {
      if (e.code === 'gone') redirect(`/a/${token}`);
      return { error: 'This business is no longer accepting agent requests.' };
    }
    // Anything else (e.g. the lead write failed): nothing was sent, the
    // proposal is still pending, and the human can retry.
    return { error: 'Could not send the request. Nothing was sent — please try again.' };
  }

  redirect(`/a/${token}`);
}

/**
 * Decline: withdraw the proposal. The row is kept with status
 * 'declined' so the confirmation page, the agent's status poll, and the
 * audit trail all agree. The purge cron removes it after 30 days.
 */
export async function declineProposal(_prev: unknown, formData: FormData) {
  const token = String(formData.get('token') || '');
  if (!token) redirect('/a/invalid');
  await unsafeUnscoped('agent:confirm:decline', (db) =>
    db.agentProposal.updateMany({
      where: { confirmToken: token, status: PROPOSAL_STATUS.PENDING },
      data: { status: PROPOSAL_STATUS.DECLINED, decidedAt: new Date() },
    })
  );
  redirect(`/a/${token}`);
}

/**
 * Claim an agent-created account: set a real password and sign in.
 * Only allowed for accounts created by a proposal approval
 * (agentCreatedAt != null) and only via the approved proposal's token.
 */
export async function claimAgentAccount(_prev: unknown, formData: FormData) {
  const token = String(formData.get('token') || '');
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  if (!token) return { error: 'Invalid link.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };

  const proposal = await unsafeUnscoped('agent:claim:lookup', (db) =>
    db.agentProposal.findUnique({
      where: { confirmToken: token },
      select: { status: true, customerId: true },
    })
  );
  if (!proposal || proposal.status !== PROPOSAL_STATUS.APPROVED || !proposal.customerId) {
    return { error: 'This link can no longer be used to claim an account.' };
  }
  const customer = await unsafeUnscoped('agent:claim:customer', (db) =>
    db.customerUser.findUnique({
      where: { id: proposal.customerId! },
      select: { id: true, agentCreatedAt: true },
    })
  );
  if (!customer || !customer.agentCreatedAt) {
    return { error: 'This account already has a password. Log in instead.' };
  }

  await unsafeUnscoped('agent:claim:setPassword', (db) =>
    db.customerUser.update({
      where: { id: customer.id },
      data: { passwordHash: hashCustomerPassword(password), agentCreatedAt: null },
    })
  );
  await createCustomerSession(customer.id);
  redirect('/customer');
}
