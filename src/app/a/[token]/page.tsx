/**
 * /a/[token] — the human-confirmation page for the EveryJob Agent Protocol.
 *
 * A customer's AI assistant proposes a quote request and hands this link
 * to its user. NOTHING was sent to the business yet: the request is
 * created only when the human taps Approve. One tap, no account needed.
 *
 * States: pending → approve/decline · approved → success (+ optional
 * account claim) · declined (withdrawn) · expired · invalid link.
 */
import Link from 'next/link';
import {
  BadgeCheck,
  Bot,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { unsafeUnscoped } from '@/lib/tenant-guard';
import { PROPOSAL_STATUS, isProposalExpired } from '@/lib/agent-protocol';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import Logo from '@/components/Logo';
import { Avatar, Card, Stagger } from '@/components/customer/ui';
import { ProposalActions, ClaimAccountForm } from './confirm-forms';

type SearchParams = { declined?: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex justify-center pt-8 pb-2">
        <Link href="/" aria-label="EveryJob home" className="ej-icon-hover rounded-2xl p-1">
          <Logo size={30} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-12">{children}</main>
    </div>
  );
}

function StateCard({
  icon,
  title,
  body,
  tone = 'zinc',
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: 'zinc' | 'green' | 'amber';
}) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-500',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
  } as const;
  return (
    <Stagger index={0}>
      <Card className="p-8 text-center">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${tones[tone]}`}>
          {icon}
        </div>
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
        <Link
          href="/directory"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0"
        >
          EveryJob Directory
        </Link>
      </Card>
    </Stagger>
  );
}

export default async function AgentConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  const { declined } = await searchParams;
  const locale = await getLocale();
  const tr = (path: string, vars?: Record<string, string>) => {
    let s = t(locale, path as never) as string;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };

  const proposal = await unsafeUnscoped('agent:page:lookup', (db) =>
    db.agentProposal.findUnique({
      where: { confirmToken: token },
      include: { business: { select: { name: true, bookingPage: { select: { slug: true } } } } },
    })
  );

  // Withdrawn: the decline action marks the row declined (kept for
  // audit; purged after 30 days). Older links used ?declined=1.
  if ((!proposal && declined === '1') || proposal?.status === PROPOSAL_STATUS.DECLINED) {
    return (
      <Shell>
        <StateCard
          icon={<CheckCircle2 className="h-7 w-7" />}
          title={tr('agent.declined.title')}
          body={tr('agent.declined.body')}
        />
      </Shell>
    );
  }
  if (!proposal) {
    return (
      <Shell>
        <StateCard
          icon={<ShieldCheck className="h-7 w-7" />}
          title={tr('agent.invalid.title')}
          body={tr('agent.invalid.body')}
          tone="amber"
        />
      </Shell>
    );
  }

  const expired =
    proposal.status === PROPOSAL_STATUS.EXPIRED ||
    (proposal.status === PROPOSAL_STATUS.PENDING && isProposalExpired(proposal.expiresAt));

  // ---- APPROVED ---------------------------------------------------------
  if (proposal.status === PROPOSAL_STATUS.APPROVED) {
    let claimable = false;
    let claimEmail: string | null = null;
    if (proposal.customerId) {
      const customer = await unsafeUnscoped('agent:page:claimable', (db) =>
        db.customerUser.findUnique({
          where: { id: proposal.customerId! },
          select: { email: true, agentCreatedAt: true },
        })
      );
      claimable = !!customer?.agentCreatedAt;
      claimEmail = customer?.email ?? null;
    }
    return (
      <Shell>
        <Stagger index={0}>
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">{tr('agent.approved.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {tr('agent.approved.body', { business: proposal.business.name })}
            </p>
          </Card>
        </Stagger>

        {claimable && claimEmail ? (
          <Stagger index={1} className="mt-4">
            <Card className="p-6">
              <h2 className="text-base font-bold text-zinc-900">{tr('agent.approved.claimTitle')}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {tr('agent.approved.claimBody', { email: claimEmail })}
              </p>
              <div className="mt-4">
                <ClaimAccountForm
                  token={token}
                  passwordLabel={tr('agent.approved.password')}
                  confirmLabel={tr('agent.approved.passwordConfirm')}
                  ctaLabel={tr('agent.approved.claimCta')}
                  creatingLabel={tr('agent.confirm.approving')}
                />
              </div>
            </Card>
          </Stagger>
        ) : (
          <Stagger index={1} className="mt-4">
            <Card className="p-6 text-center">
              <p className="text-sm text-zinc-600">{tr('agent.approved.haveAccount')}</p>
              <div className="mt-4 flex gap-2">
                <Link
                  href="/customer/login"
                  className="flex-1 rounded-2xl bg-indigo-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500"
                >
                  {tr('agent.approved.login')}
                </Link>
                <Link
                  href="/directory"
                  className="flex-1 rounded-2xl bg-zinc-100 px-6 py-3 text-center text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
                >
                  {tr('agent.approved.browse')}
                </Link>
              </div>
            </Card>
          </Stagger>
        )}
      </Shell>
    );
  }

  // ---- EXPIRED ----------------------------------------------------------
  if (expired) {
    return (
      <Shell>
        <StateCard
          icon={<Clock className="h-7 w-7" />}
          title={tr('agent.expired.title')}
          body={tr('agent.expired.body')}
          tone="amber"
        />
      </Shell>
    );
  }

  // ---- PENDING ----------------------------------------------------------
  const contactRows = [
    { icon: User, label: proposal.customerName },
    proposal.customerPhone ? { icon: Phone, label: proposal.customerPhone } : null,
    proposal.customerEmail ? { icon: Mail, label: proposal.customerEmail } : null,
    proposal.customerCity ? { icon: MapPin, label: proposal.customerCity } : null,
  ].filter(Boolean) as { icon: typeof User; label: string }[];

  return (
    <Shell>
      <Stagger index={0}>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {tr('agent.confirm.proposedBy', { agent: proposal.agentName })}
            </p>
            <p className="text-xs text-zinc-500">{tr('agent.confirm.title')}</p>
          </div>
        </div>
      </Stagger>

      <Stagger index={1}>
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {tr('agent.confirm.to')}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={proposal.business.name} logoUrl={null} size="md" />
            <div>
              <p className="font-bold text-zinc-900">{proposal.business.name}</p>
              <p className="flex items-center gap-1 text-xs text-green-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified pro
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-zinc-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {tr('agent.confirm.service')}
            </p>
            <p className="mt-1 text-lg font-bold text-zinc-900">{proposal.service}</p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {tr('agent.confirm.details')}
            </p>
            <p className="mt-1 rounded-xl bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-700">
              {proposal.description}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {tr('agent.confirm.contact')}
            </p>
            <ul className="mt-2 space-y-2">
              {contactRows.map((row) => (
                <li key={row.label} className="flex items-center gap-2.5 text-sm text-zinc-700">
                  <row.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                  {row.label}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </Stagger>

      <Stagger index={2} className="mt-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" /> {tr('agent.confirm.expiry')}
        </p>
      </Stagger>

      <Stagger index={3} className="mt-3">
        <ProposalActions
          token={token}
          approveLabel={tr('agent.confirm.approve')}
          approvingLabel={tr('agent.confirm.approving')}
          declineLabel={tr('agent.confirm.decline')}
        />
      </Stagger>

      <Stagger index={4} className="mt-4">
        <p className="flex items-start justify-center gap-1.5 px-2 text-center text-xs leading-relaxed text-zinc-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
          {tr('agent.confirm.note')}
        </p>
      </Stagger>
    </Shell>
  );
}
