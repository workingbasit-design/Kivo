'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ListScreen,
  type ListScreenFilter,
  type ListScreenGroup,
  type ListScreenRow,
} from '@/components/patterns';
import { BottomSheet, StatusBadge } from '@/components/kit';
import TradeIcon from '@/components/TradeIcon';
import type { IconComponent } from '@/components/icons';
import { ArrowUpDown, Briefcase, CheckCircle2, Clock3, FileText, Plus } from '@/components/icons';
import {
  searchJobRows,
  sortJobRows,
  formatWasDueDate,
  JOB_LIST_GROUP_ORDER,
  type JobListRowVm,
  type JobListSort,
  type JobListFilterId,
  type JobListGroupId,
} from '@/lib/jobs-list';
import { formatJobTime, cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import { tp } from '@/lib/i18n/plural';
import type { TradeKey } from '@/lib/trade-icons';

/** Stable icon element per trade key for the kit ListRow. */
const tradeIconCache = new Map<TradeKey, ReactNode>();
function tradeIconNode(trade: TradeKey): ReactNode {
  const hit = tradeIconCache.get(trade);
  if (hit) return hit;
  const el = <TradeIcon trade={trade} size={22} />;
  tradeIconCache.set(trade, el);
  return el;
}

/** "$310" when whole dollars, "$310.50" otherwise (mockup style). */
function formatCompactCAD(cents: number, noCharge: boolean): string {
  if (noCharge) return '$0';
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString('en-CA')}`
    : `$${dollars.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FILTER_ORDER: JobListFilterId[] = ['all', 'late', 'today', 'upcoming', 'invoice'];
const FILTER_ICONS: Record<JobListFilterId, IconComponent> = {
  all: Briefcase,
  late: Clock3,
  today: Clock3,
  upcoming: Clock3,
  invoice: FileText,
};

export interface JobsListClientProps {
  rows: JobListRowVm[];
  locale: Locale;
  timezone: string;
  summary: string;
  todayKey: string;
  tomorrowKey: string;
}

/**
 * Jobs list screen (Part 3 group 1): the ListScreen pattern fed by the
 * server-computed rows. Search, sort and filter selection are client-side
 * so the chips, counts and groups can never drift apart.
 */
export default function JobsListClient({
  rows,
  locale,
  timezone,
  summary,
  todayKey,
  tomorrowKey,
}: JobsListClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<JobListFilterId>('all');
  const [sort, setSort] = useState<JobListSort>('date');
  const [sortOpen, setSortOpen] = useState(false);

  const jobsL = (k: string) => t(locale, `jobs.${k}`);

  const weekdayName = (dayKey: string) => {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      weekday: 'long',
      timeZone: timezone,
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  };

  const rowMeta = (r: JobListRowVm) => {
    const timeLabel = r.time ? formatJobTime(r.time, locale) : null;
    const badges: React.ReactNode[] = [];
    if (r.late) {
      badges.push(
        <StatusBadge key="late" tone="late">
          {jobsL('filterLate')}
        </StatusBadge>,
      );
    } else if (r.runningOver) {
      badges.push(
        <StatusBadge key="over" tone="warn">
          {jobsL('runningOver')}
        </StatusBadge>,
      );
    } else if (r.status === 'COMPLETED' || r.status === 'PAID') {
      badges.push(
        <StatusBadge key="done" tone="done">
          {jobsL('stepDone')}
        </StatusBadge>,
      );
    } else if (r.status === 'CANCELLED') {
      badges.push(
        <StatusBadge key="cancelled" tone="neutral">
          {jobsL('cancelled')}
        </StatusBadge>,
      );
    }
    if (r.techName && !r.late && r.status !== 'COMPLETED' && r.status !== 'PAID' && r.status !== 'CANCELLED') {
      badges.push(
        <StatusBadge key="tech" tone="scheduled">
          {r.techName}
        </StatusBadge>,
      );
    }
    const secondLine = r.uninvoiced ? (
      <span key="inv-break" className="w-full" aria-hidden="true" />
    ) : null;
    const notInvoiced = r.uninvoiced ? (
      <StatusBadge key="notinv" tone="warn">
        {jobsL('notInvoiced')}
      </StatusBadge>
    ) : null;

    if (r.groupId === 'late') {
      return (
        <>
          <span className="num">{jobsL('wasDue').replace('{date}', formatWasDueDate(r.dayKey, timezone, locale))}</span>
          {badges}
        </>
      );
    }
    if (r.groupId === 'earlier') {
      return (
        <>
          <span className="num">{formatWasDueDate(r.dayKey, timezone, locale)}</span>
          {badges}
          {secondLine}
          {notInvoiced}
        </>
      );
    }
    return (
      <>
        {timeLabel && <span className="num">{timeLabel}</span>}
        {!timeLabel && <span>{jobsL('noTimeSet')}</span>}
        {badges}
        {secondLine}
        {notInvoiced}
      </>
    );
  };

  const groups: ListScreenGroup[] = useMemo(() => {
    const narrowed = searchJobRows(rows, query);
    return JOB_LIST_GROUP_ORDER.map((groupId: JobListGroupId) => {
      const inGroup = sortJobRows(
        narrowed.filter((r) => r.groupId === groupId),
        sort,
        locale,
      );
      const listRows: ListScreenRow[] = inGroup.map((r) => ({
        rowKey: r.id,
        filterIds: r.filterIds,
        icon: tradeIconNode(r.tradeKey),
        title: r.title,
        subtitle: r.address ? `${r.customerName}, ${r.address}` : r.customerName,
        meta: rowMeta(r),
        amount: formatCompactCAD(r.priceCents, r.noCharge),
        href: `/jobs/${r.id}`,
      }));
      const headings: Record<JobListGroupId, string> = {
        late: jobsL('groupLate'),
        today: jobsL('groupToday').replace('{weekday}', weekdayName(todayKey)),
        tomorrow: jobsL('groupTomorrow').replace('{weekday}', weekdayName(tomorrowKey)),
        later: jobsL('groupLater'),
        earlier: jobsL('groupEarlierWeek'),
      };
      return {
        id: groupId,
        heading: headings[groupId],
        headingTone: (groupId === 'late' ? 'danger' : 'default') as 'danger' | 'default',
        headingMeta:
          groupId === 'today' || groupId === 'tomorrow'
            ? tp(locale, 'jobs.jobsCount', inGroup.length)
            : undefined,
        rows: listRows,
      };
    }).filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort, locale, timezone, todayKey, tomorrowKey]);

  const filters: ListScreenFilter[] = FILTER_ORDER.map((id) => {
    const Icon = FILTER_ICONS[id];
    const emptyKeys: Record<JobListFilterId, { title: string; text: string }> = {
      all: { title: jobsL('emptyAllTitle'), text: jobsL('emptyAllText') },
      late: { title: jobsL('emptyLateTitle'), text: jobsL('emptyLateText') },
      today: { title: jobsL('emptyTodayTitle'), text: jobsL('emptyTodayText') },
      upcoming: { title: jobsL('emptyUpcomingTitle'), text: jobsL('emptyUpcomingText') },
      invoice: { title: jobsL('emptyInvoiceTitle'), text: jobsL('emptyInvoiceText') },
    };
    return {
      id,
      label: jobsL(
        id === 'all'
          ? 'filterAll'
          : id === 'late'
            ? 'filterLate'
            : id === 'today'
              ? 'filterToday'
              : id === 'upcoming'
                ? 'filterUpcoming'
                : 'filterToInvoice',
      ),
      tone: id === 'late' ? 'danger' : 'default',
      empty: {
        icon: <Icon />,
        title: emptyKeys[id].title,
        text: emptyKeys[id].text,
        ...(id === 'all'
          ? {
              actionLabel: jobsL('createFirstJob'),
              onAction: () => router.push('/jobs/new'),
            }
          : {}),
      },
    };
  });

  const sortLabels: Record<JobListSort, string> = {
    date: jobsL('sortSoonest'),
    amount: jobsL('sortHighest'),
    customer: jobsL('sortCustomerAZ'),
  };

  return (
    <>
      <ListScreen
        title={jobsL('title')}
        summary={summary}
        actionLabel={jobsL('newJob')}
        actionIcon={<Plus />}
        actionHref="/jobs/new"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={jobsL('searchPlaceholder')}
        searchLabel={jobsL('filtersLabel')}
        searchClearLabel={jobsL('clearSearch')}
        filtersLabel={jobsL('filtersLabel')}
        filters={filters}
        selectedFilterId={filterId}
        onSelectFilter={(id) => setFilterId(id as JobListFilterId)}
        groups={groups}
        belowChips={
          <div className="mt-1 mb-1 flex items-center justify-between px-[2px]">
            <span className="text-[14px] font-medium text-ink-2">{sortLabels[sort]}</span>
            <button
              type="button"
              onClick={() => setSortOpen(true)}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3',
                'text-[15px] font-semibold text-ink',
                'focus-visible:outline-2 focus-visible:outline-focus active:bg-surface-2',
              )}
            >
              <ArrowUpDown size={18} aria-hidden="true" />
              {jobsL('sortButton')}
            </button>
          </div>
        }
      />
      <BottomSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title={jobsL('sortSheetTitle')}
      >
        <div className="flex flex-col gap-1 pb-2">
          {(Object.keys(sortLabels) as JobListSort[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSort(key);
                setSortOpen(false);
              }}
              aria-pressed={sort === key}
              className={cn(
                'flex min-h-[52px] items-center justify-between rounded-xl px-4 text-left',
                'text-[16px] font-semibold',
                sort === key ? 'bg-surface-2 text-ink' : 'text-ink-2',
              )}
            >
              {sortLabels[key]}
              {sort === key && <CheckCircle2 size={20} className="text-ok" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
