'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DetailScreen,
  type DetailSection,
} from '@/components/patterns';
import { Avatar, BottomSheet, Card, LineItems, MarginBar, ProgressSteps, StatusBadge, type ProgressStep, type StatusBadgeProps } from '@/components/kit';
import type { IconComponent } from '@/components/icons';
import TradeIcon from '@/components/TradeIcon';
import {
  Clock,
  Mail,
  MessageSquareText,
  MoreVertical,
  Navigation,
  Pencil,
  Phone,
  User,
} from '@/components/icons';
import { JobChecklist } from '@/components/JobChecklist';
import { JobExpenses } from '@/components/JobExpenses';
import JobTimeEntryForm from '@/components/JobTimeEntryForm';
import { JobNoteForm, JobNoteItem } from '@/components/JobNoteForm';
import Attachments from '@/components/Attachments';
import ReviewLinkButton from '@/components/ReviewLinkButton';

import { updateJobStatus, deleteJob } from '@/app/actions/jobs';
import { assignJobTechnician } from '@/app/actions/dispatch';
import { previousPipelineStatus, jobStatusLabel } from '@/lib/job-status';
import { formatMoney } from '@/lib/money';
import { localeMoneyTag, statusLabel, cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import { tp } from '@/lib/i18n/plural';
import type { TradeKey } from '@/lib/trade-icons';
import { Timeline } from '../../_components/Timeline';

export interface JobDetailVm {
  id: string;
  title: string;
  status: string;
  tradeKey: TradeKey;
  late: boolean;
  runningOver: boolean;
  whenPrimary: string;
  whenSecondary: string;
  address: string | null;
  notes: string | null;
  priceCents: number;
  taxLabel: string;
  taxCents: number;
  totalCents: number;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    initials: string;
    sinceYear: number;
    jobsCount: number;
  };
  tech: { id: string; name: string; initials: string } | null;
  members: { id: string; name: string; initials: string }[];
  /** Pipeline stage index (NEW=0 … PAID=4); -1 when CANCELLED. */
  progressStage: number;
  bookedLabel: string;
  statusChangedLabel: string;
  statusLabel: string;
  createdLabel: string;
  invoices: {
    id: string;
    number: string;
    label: string;
    totalCents: number;
    status: string;
  }[];
  uninvoiced: boolean;
  costing: {
    profitCents: number;
    marginPct: number | null;
    costCents: number;
    laborCents: number;
    laborDuration: string;
    expensesCents: number;
    hourlyRate: number | null;
  } | null;
  jobNotes: {
    id: string;
    content: string;
    authorName: string;
    createdAtLabel: string;
  }[];
  checklistItems: { id: string; label: string; done: boolean }[];
  checklistTemplates: { id: string; name: string }[];
  expenses: {
    id: string;
    description: string;
    amount: number;
    category: string;
    spentAt: string;
  }[];
  currency: string;
  timeEntries: {
    name: string;
    dateLabel: string;
    active: boolean;
    minutes: number;
  }[];
  timeEntryMembers: { id: string; name: string | null; email: string }[];
  isAdmin: boolean;
  selfId: string;
  reviewEligible: boolean;
  locale: Locale;
}

/** Titled card inside a bare DetailScreen section (mockup section rhythm). */
function SubCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mx-[2px] mb-2 mt-5 flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-[18px] font-bold text-ink">{title}</h2>
        {meta && (
          <span className="text-[14px] font-semibold text-ink-2">{meta}</span>
        )}
      </div>
      <Card className="px-3.5 py-1">{children}</Card>
    </section>
  );
}

const miniBtnClass = cn(
  'inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg',
  'border border-line bg-surface px-3 text-[14px] font-semibold text-ink',
  'active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus',
);

const contactBtnClass = cn(
  'flex min-h-[62px] min-w-[44px] flex-col items-center justify-center gap-1',
  'rounded-[14px] bg-surface-2 text-[13px] font-semibold text-ink',
  'ring-1 ring-inset ring-line active:bg-surface',
  'focus-visible:outline-2 focus-visible:outline-focus',
);

function invoiceTone(status: string): StatusBadgeProps['tone'] {
  if (status === 'PAID') return 'done';
  if (status === 'VOID') return 'neutral';
  if (status === 'UNPAID' || status === 'PARTIALLY PAID') return 'warn';
  return 'info';
}

function statusTone(status: string): StatusBadgeProps['tone'] {
  if (status === 'COMPLETED' || status === 'PAID') return 'done';
  if (status === 'IN PROGRESS') return 'info';
  if (status === 'CANCELLED') return 'neutral';
  if (status === 'NEW') return 'info';
  return 'scheduled';
}

export default function JobDetailClient({ vm }: { vm: JobDetailVm }) {
  const router = useRouter();
  const locale = vm.locale;
  const jobsL = (k: string) => t(locale, `jobs.${k}`);
  const moneyTag = localeMoneyTag(locale);
  const fmtMoney = (cents: number) => formatMoney(cents / 100, vm.currency, moneyTag);

  const [status, setStatus] = useState(vm.status);
  const [tech, setTech] = useState(vm.tech);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [isPending, startTransition] = useTransition();

  const tradeIconNode = <TradeIcon trade={vm.tradeKey} size={28} />;

  const runStatus = (next: string, after?: () => void) => {
    startTransition(async () => {
      const res = await updateJobStatus(vm.id, next);
      if (res?.error) {
        toast.error(jobsL('statusError'));
      } else {
        setStatus(next);
        toast.success(jobsL('statusChanged'));
        router.refresh();
        after?.();
      }
    });
  };

  const runAssign = (userId: string, name: string) => {
    startTransition(async () => {
      const res = await assignJobTechnician(vm.id, userId);
      if (!res.ok) {
        toast.error(jobsL('assignError'));
      } else {
        setTech({ id: userId, name, initials: tech?.initials ?? '' });
        toast.success(jobsL('assignedTo').replace('{name}', name));
        router.refresh();
      }
    });
  };

  const runDelete = () => {
    startTransition(async () => {
      await deleteJob(vm.id);
      router.push('/jobs');
    });
  };

  /* ---- badges ---- */
  const badges: StatusBadgeProps[] = [
    { tone: statusTone(status), children: vm.statusLabel },
  ];
  if (vm.late && (status === 'NEW' || status === 'SCHEDULED')) {
    badges.push({ tone: 'late', children: jobsL('filterLate') });
  }
  if (vm.runningOver && status === 'IN PROGRESS') {
    badges.push({ tone: 'warn', children: jobsL('runningOver') });
  }
  if (!tech && (status === 'NEW' || status === 'SCHEDULED')) {
    badges.push({
      tone: 'warn',
      icon: <User />,
      children: jobsL('noTechnicianYet'),
    });
  }

  /* ---- sticky action bar: the one next step ---- */
  const firstMember = vm.members[0];
  let primaryLabel = '';
  let onPrimary: () => void = () => {};
  let secondaryLabel: string | undefined;
  let onSecondary: (() => void) | undefined;

  const goEdit = () => router.push(`/jobs/${vm.id}/edit`);
  if (status === 'NEW' || status === 'SCHEDULED') {
    if (tech) {
      primaryLabel = jobsL('startJob');
      onPrimary = () => runStatus('IN PROGRESS');
    } else if (firstMember) {
      primaryLabel = jobsL('assignName').replace('{name}', firstMember.name.split(' ')[0]);
      onPrimary = () => runAssign(firstMember.id, firstMember.name);
    } else {
      primaryLabel = jobsL('startJob');
      onPrimary = () => runStatus('IN PROGRESS');
    }
    secondaryLabel = jobsL('reschedule');
    onSecondary = goEdit;
  } else if (status === 'IN PROGRESS') {
    primaryLabel = jobsL('completeJob');
    onPrimary = () => runStatus('COMPLETED');
    const undoTo = previousPipelineStatus(status);
    if (undoTo) {
      secondaryLabel = t(locale, 't10work.statusBack').replace(
        '{status}',
        jobStatusLabel(undoTo, locale),
      );
      onSecondary = () => runStatus(undoTo);
    }
  } else if (status === 'COMPLETED') {
    if (vm.uninvoiced) {
      primaryLabel = jobsL('createInvoice');
      onPrimary = () => router.push('/invoices/new');
    } else if (vm.invoices[0]) {
      primaryLabel = jobsL('viewInvoice');
      onPrimary = () => router.push(`/invoices/${vm.invoices[0].id}`);
    } else {
      primaryLabel = jobsL('editJob');
      onPrimary = goEdit;
    }
    secondaryLabel = jobsL('editJob');
    onSecondary = goEdit;
  } else if (status === 'PAID') {
    if (vm.invoices[0]) {
      primaryLabel = jobsL('viewInvoice');
      onPrimary = () => router.push(`/invoices/${vm.invoices[0].id}`);
    } else {
      primaryLabel = jobsL('editJob');
      onPrimary = goEdit;
    }
    secondaryLabel = jobsL('editJob');
    onSecondary = goEdit;
  } else if (status === 'CANCELLED') {
    primaryLabel = jobsL('reopenJob');
    onPrimary = () => runStatus('SCHEDULED');
  }

  /* ---- sections ---- */
  const directionsUrl = vm.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vm.address)}`
    : null;

  const whenWhere = (
    <div className="divide-y divide-line">
      <div className="flex items-center gap-3 py-3">
        <Clock size={22} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[16px] font-bold text-ink">{vm.whenPrimary}</p>
          <p className="m-0 text-[14px] text-ink-2">{vm.whenSecondary}</p>
        </div>
        <button type="button" className={miniBtnClass} onClick={goEdit}>
          {jobsL('reschedule')}
        </button>
      </div>
      <div className="flex items-center gap-3 py-3">
        <Navigation size={22} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[16px] font-bold text-ink">
            {vm.address ?? '—'}
          </p>
        </div>
        {directionsUrl && (
          <a
            className={miniBtnClass}
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {jobsL('directions')}
          </a>
        )}
      </div>
    </div>
  );

  const contactButtons = [
    vm.customer.phone && {
      label: jobsL('call'),
      Icon: Phone,
      href: `tel:${vm.customer.phone}`,
    },
    vm.customer.phone && {
      label: jobsL('text'),
      Icon: MessageSquareText,
      href: `sms:${vm.customer.phone}`,
    },
    vm.customer.email && {
      label: jobsL('email'),
      Icon: Mail,
      href: `mailto:${vm.customer.email}`,
    },
    {
      label: jobsL('profile'),
      Icon: User,
      href: `/customers/${vm.customer.id}`,
    },
  ].filter(Boolean) as { label: string; Icon: typeof Phone; href: string }[];

  const who = (
    <div>
      <div className="flex items-center gap-3 py-3">
        <Avatar initials={vm.customer.initials} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[17px] font-bold text-ink">{vm.customer.name}</p>
          <p className="m-0 text-[14px] text-ink-2">
            {jobsL('customerSince').replace('{year}', String(vm.customer.sinceYear))}
            {', '}
            {tp(locale, 'jobs.jobsCount', vm.customer.jobsCount)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 pb-2 pt-0.5">
        {contactButtons.map(({ label, Icon, href }) => (
          <a key={label} href={href} className={contactBtnClass}>
            <Icon size={22} aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
    </div>
  );

  const assignCard = (
    <Card className="px-3.5 py-1">
      {vm.members.map((m) => {
        const assigned = tech?.id === m.id;
        return (
          <div
            key={m.id}
            className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
          >
            <Avatar initials={m.initials} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[16px] font-bold text-ink">{m.name}</p>
            </div>
            {assigned ? (
              <StatusBadge tone="done">{jobsL('assigned')}</StatusBadge>
            ) : (
              <button
                type="button"
                className={miniBtnClass}
                disabled={isPending}
                onClick={() => runAssign(m.id, m.name)}
              >
                {jobsL('assign')}
              </button>
            )}
          </div>
        );
      })}
    </Card>
  );

  const stageLabels = [
    jobsL('stepBooked'),
    statusLabel('SCHEDULED', locale),
    statusLabel('IN PROGRESS', locale),
    jobsL('stepDone'),
    jobsL('stepInvoicedPaid'),
  ];
  const stage = vm.progressStage;
  const steps: ProgressStep[] =
    stage < 0
      ? [
          { label: stageLabels[0], sub: vm.bookedLabel, state: 'done' },
          { label: jobsL('cancelled'), sub: vm.statusChangedLabel, state: 'now' },
        ]
      : stageLabels.map((label, i) => ({
          label,
          sub: i === 0 ? vm.bookedLabel : i === stage ? vm.statusChangedLabel : undefined,
          state: i < stage ? 'done' : i === stage ? 'now' : 'todo',
        }));

  const whatsNext: DetailSection = {
    title: jobsL('assignTechnician'),
    bare: true,
    content: (
      <>
        {assignCard}
        <SubCard title={t(locale, 'jobs.progress')}>
          <ProgressSteps steps={steps} />
        </SubCard>
        <div className="mt-5">
          <JobChecklist
            jobId={vm.id}
            items={vm.checklistItems}
            templates={vm.checklistTemplates}
            locale={locale}
          />
        </div>
      </>
    ),
  };

  const moneySection: DetailSection = {
    title: jobsL('workAndPrice'),
    bare: true,
    content: (
      <>
        <Card className="px-3.5 py-2">
          <LineItems
            lines={[
              {
                title: vm.title,
                amountCents: vm.priceCents,
              },
            ]}
            subtotalLabel={t(locale, 't10money.subtotalLabel')}
            subtotalCents={vm.priceCents}
            taxLabel={vm.taxLabel}
            taxCents={vm.taxCents}
            totalLabel={t(locale, 't10money.totalLabel')}
            totalCents={vm.totalCents}
          />
        </Card>
        {vm.costing && (
          <SubCard title={jobsL('jobCosting')} meta={jobsL('estimate')}>
            <div className="py-2">
              <MarginBar
                profitLabel={jobsL('profit')}
                profitCents={vm.costing.profitCents}
                marginPct={vm.costing.marginPct ?? 0}
                marginLabel={jobsL('marginWord')}
                costLabel={jobsL('costBreakdown')
                  .replace('{costs}', fmtMoney(vm.costing.costCents))
                  .replace(
                    '{detail}',
                    `${jobsL('labourWord')} ${vm.costing.laborDuration}, ${fmtMoney(vm.costing.laborCents)}; ${jobsL('expenses').toLowerCase()} ${fmtMoney(vm.costing.expensesCents)}`,
                  )}
                barLabel={`${jobsL('jobCosting')}: ${vm.costing.marginPct ?? 0}% ${jobsL('marginWord')}`}
              />
            </div>
          </SubCard>
        )}
        <SubCard title={jobsL('invoices')}>
          {vm.invoices.length === 0 ? (
            <p className="m-0 py-3 text-[14px] text-ink-2">{jobsL('noInvoicesYet')}</p>
          ) : (
            <div className="divide-y divide-line">
              {vm.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex min-h-[56px] items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {inv.label}
                    </span>
                    <StatusBadge tone={invoiceTone(inv.status)}>
                      {statusLabel(inv.status, locale)}
                    </StatusBadge>
                  </span>
                  <span className="num shrink-0 text-[16px] font-bold text-ink">
                    {fmtMoney(inv.totalCents)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SubCard>
        <div className="mt-5">
          <JobExpenses
            jobId={vm.id}
            expenses={vm.expenses}
            locale={locale}
            currency={vm.currency}
          />
        </div>
      </>
    ),
  };

  const notesPhotos: DetailSection = {
    title: jobsL('notesAndPhotos'),
    bare: true,
    content: (
      <>
        <Card className="px-3.5 py-3">
          {vm.notes && (
            <p className="m-0 whitespace-pre-wrap pb-3 text-[15px] text-ink">
              {vm.notes}
            </p>
          )}
          {vm.jobNotes.length === 0 && !vm.notes ? (
            <p className="m-0 pb-2 text-[14px] text-ink-2">
              {t(locale, 't10work.jobNotesEmpty')}
            </p>
          ) : (
            <div className="pb-2">
              {vm.jobNotes.map((n) => (
                <JobNoteItem
                  key={n.id}
                  jobId={vm.id}
                  locale={locale}
                  noteId={n.id}
                  content={n.content}
                  authorName={n.authorName}
                  createdAt={n.createdAtLabel}
                />
              ))}
            </div>
          )}
          <div className="border-t border-line pt-3">
            <JobNoteForm jobId={vm.id} locale={locale} />
          </div>
        </Card>
        <div className="mt-5">
          <Attachments entityType="job" entityId={vm.id} locale={locale} />
        </div>
      </>
    ),
  };

  const history: DetailSection = {
    title: jobsL('history'),
    bare: true,
    content: (
      <>
        <Card className="px-3.5 py-3">
          <Timeline
            items={[
              { title: vm.createdLabel, timestamp: vm.bookedLabel },
              ...(stage !== 0
                ? [
                    {
                      title: vm.statusLabel,
                      timestamp: vm.statusChangedLabel,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
        <SubCard title={jobsL('timeLogged')}>
          {vm.timeEntries.length > 0 && (
            <div className="divide-y divide-line">
              {vm.timeEntries.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[15px] font-semibold text-ink">
                      {e.name}
                    </p>
                    <p className="m-0 text-[13px] text-ink-2">{e.dateLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.active && (
                      <StatusBadge tone="info">
                        {statusLabel('IN PROGRESS', locale)}
                      </StatusBadge>
                    )}
                    <span className="num text-[15px] font-bold text-ink">
                      {e.minutes >= 60
                        ? `${Math.floor(e.minutes / 60)}h ${e.minutes % 60}m`
                        : `${e.minutes}m`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-line pt-1 first:border-t-0">
            <JobTimeEntryForm
              jobId={vm.id}
              jobTitle={vm.title}
              members={vm.timeEntryMembers}
              isAdmin={vm.isAdmin}
              selfId={vm.selfId}
              locale={locale}
            />
          </div>
        </SubCard>
      </>
    ),
  };

  const undoTo = previousPipelineStatus(status);
  const canCancel = status !== 'PAID' && status !== 'CANCELLED';
  const moreActions = (
    <div className="flex flex-col gap-1 pb-2">
      <button
        type="button"
        className={sheetActionClass}
        onClick={() => {
          setMoreOpen(false);
          goEdit();
        }}
      >
        <Pencil size={20} aria-hidden="true" /> {jobsL('editJob')}
      </button>
      {undoTo && (
        <button
          type="button"
          className={sheetActionClass}
          onClick={() => {
            setMoreOpen(false);
            runStatus(undoTo);
          }}
        >
          <Clock size={20} aria-hidden="true" />{' '}
          {t(locale, 't10work.statusBack').replace(
            '{status}',
            jobStatusLabel(undoTo, locale),
          )}
        </button>
      )}
      {vm.reviewEligible && (
        <div className="px-1 py-1">
          <ReviewLinkButton
            jobId={vm.id}
            idleLabel={t(locale, 't10work.jobRequestReview')}
            copiedLabel={t(locale, 't10work.jobReviewLinkCopied')}
            errorLabel={t(locale, 't10work.jobReviewLinkFailed')}
          />
        </div>
      )}
      {canCancel && (
        <button
          type="button"
          className={cn(sheetActionClass, 'text-danger')}
          onClick={() => {
            setMoreOpen(false);
            setConfirm('cancel');
          }}
        >
          {jobsL('cancelJob')}
        </button>
      )}
      <button
        type="button"
        className={cn(sheetActionClass, 'text-danger')}
        onClick={() => {
          setMoreOpen(false);
          setConfirm('delete');
        }}
      >
        {jobsL('deleteJob')}
      </button>
    </div>
  );

  return (
    <div className="pb-32">
      <DetailScreen
        backLabel={jobsL('detailBack')}
        onBack={() => router.back()}
        topActions={[
          {
            icon: MoreVertical,
            label: jobsL('moreActions'),
            onClick: () => setMoreOpen(true),
          },
        ]}
        icon={tradeIconNode}
        title={vm.title}
        subtitle={jobsL('forCustomer').replace('{name}', vm.customer.name)}
        badges={badges}
        whenWhere={{ content: whenWhere }}
        who={{ content: who }}
        whatsNext={whatsNext}
        money={moneySection}
        notesPhotos={notesPhotos}
        history={history}
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        secondaryLabel={secondaryLabel}
        onSecondary={onSecondary}
      />
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={jobsL('moreActions')}
      >
        {moreActions}
      </BottomSheet>
      <BottomSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === 'cancel' ? jobsL('confirmCancelTitle') : jobsL('confirmDeleteTitle')
        }
        doneLabel={confirm === 'cancel' ? jobsL('yesCancel') : jobsL('yesDelete')}
        cancelLabel={jobsL('keepIt')}
        onDone={() => {
          if (confirm === 'cancel') {
            setConfirm(null);
            runStatus('CANCELLED');
          } else {
            setConfirm(null);
            runDelete();
          }
        }}
      >
        <p className="text-[15px] text-ink-2">
          {confirm === 'cancel' ? jobsL('confirmCancelBody') : jobsL('confirmDeleteBody')}
        </p>
      </BottomSheet>
    </div>
  );
}

const sheetActionClass = cn(
  'flex min-h-[52px] items-center gap-3 rounded-xl px-4 text-left',
  'text-[16px] font-semibold text-ink active:bg-surface-2',
  'focus-visible:outline-2 focus-visible:outline-focus',
);
