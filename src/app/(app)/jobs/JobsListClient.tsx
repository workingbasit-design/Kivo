'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Plus,
  Search,
  X,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { StatusBadge } from '@/components/kit';
import TradeIcon from '@/components/TradeIcon';
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
import {
  computeFilterCounts,
  visibleGroupsForFilter,
} from '@/components/patterns/list-logic';
import { formatJobTime, cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import { tp } from '@/lib/i18n/plural';
import type { TradeKey } from '@/lib/trade-icons';
import NewJobModal from '@/components/NewJobModal';
import type { JobFormCustomer, JobFormCrew } from '@/components/JobForm';

/** Stable icon element per trade key for the job card. */
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

interface JobsGroup {
  id: JobListGroupId;
  heading: string;
  headingTone: 'danger' | 'default';
  headingMeta?: string;
  rows: JobListRowVm[];
}

export interface JobsListClientProps {
  rows: JobListRowVm[];
  locale: Locale;
  timezone: string;
  summary: string;
  todayKey: string;
  tomorrowKey: string;
  /** Customers + crews for the New Job modal's real JobForm. */
  customers: JobFormCustomer[];
  crews: JobFormCrew[];
}

/**
 * Jobs list screen (Jobs redesign, ChatGPT Jobs prototype): the prototype's
 * header, search, filter pills with live counts, sort menu, grouped job
 * cards and New Job modal, fed by the server-computed rows. Search, sort
 * and filter selection are client-side so the chips, counts and groups can
 * never drift apart. The modal creates a real job through the existing
 * server action — never sample data.
 */
export default function JobsListClient({
  rows,
  locale,
  timezone,
  summary,
  todayKey,
  tomorrowKey,
  customers,
  crews,
}: JobsListClientProps) {
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<JobListFilterId>('all');
  const [sort, setSort] = useState<JobListSort>('date');
  const [sortOpen, setSortOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const jobsL = (k: string) => t(locale, `jobs.${k}`);

  // Close the sort menu on outside tap / Escape; Cmd/Ctrl+K focuses search.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const weekdayName = (dayKey: string) => {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      weekday: 'long',
      timeZone: timezone,
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  };

  /** Time / was-due / date line for a card (the Late and Earlier groups
   *  show the date instead of the time). */
  const metaLine = (r: JobListRowVm) => {
    const timeLabel = r.time ? formatJobTime(r.time, locale) : null;
    if (r.groupId === 'late') {
      return (
        <span className="num">{jobsL('wasDue').replace('{date}', formatWasDueDate(r.dayKey, timezone, locale))}</span>
      );
    }
    if (r.groupId === 'earlier') {
      return <span className="num">{formatWasDueDate(r.dayKey, timezone, locale)}</span>;
    }
    if (timeLabel) return <span className="num">{timeLabel}</span>;
    return <span>{jobsL('noTimeSet')}</span>;
  };

  /** Status badges for a card. Late is derived by the shared classifier
   *  (not started + start time passed); in-progress work past its end
   *  time is "Running over", never Late. */
  const metaBadges = (r: JobListRowVm) => {
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
    if (r.uninvoiced) {
      badges.push(
        <StatusBadge key="notinv" tone="warn">
          {jobsL('notInvoiced')}
        </StatusBadge>,
      );
    }
    return badges;
  };

  const groups: JobsGroup[] = useMemo(() => {
    const narrowed = searchJobRows(rows, query);
    return JOB_LIST_GROUP_ORDER.map((groupId: JobListGroupId) => {
      const inGroup = sortJobRows(
        narrowed.filter((r) => r.groupId === groupId),
        sort,
        locale,
      );
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
        rows: inGroup,
      };
    }).filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort, locale, timezone, todayKey, tomorrowKey]);

  // Live counts, computed from the (search-narrowed) rows — never hand-written.
  const counts = computeFilterCounts(groups, FILTER_ORDER);
  const visible = visibleGroupsForFilter(groups, filterId);

  const filterLabel = (id: JobListFilterId) =>
    jobsL(
      id === 'all'
        ? 'filterAll'
        : id === 'late'
          ? 'filterLate'
          : id === 'today'
            ? 'filterToday'
            : id === 'upcoming'
              ? 'filterUpcoming'
              : 'filterToInvoice',
    );

  const sortLabels: Record<JobListSort, string> = {
    date: jobsL('sortSoonest'),
    amount: jobsL('sortHighest'),
    customer: jobsL('sortCustomerAZ'),
  };

  const emptyKeys: Record<JobListFilterId, { title: string; text: string }> = {
    all: { title: jobsL('emptyAllTitle'), text: jobsL('emptyAllText') },
    late: { title: jobsL('emptyLateTitle'), text: jobsL('emptyLateText') },
    today: { title: jobsL('emptyTodayTitle'), text: jobsL('emptyTodayText') },
    upcoming: { title: jobsL('emptyUpcomingTitle'), text: jobsL('emptyUpcomingText') },
    invoice: { title: jobsL('emptyInvoiceTitle'), text: jobsL('emptyInvoiceText') },
  };
  const empty = emptyKeys[filterId];
  const EmptyIcon = FILTER_ICONS[filterId];
  const showClearFilters = query !== '' || filterId !== 'all';

  return (
    <div className="ej-jobs">
      <header className="ej-jobs-header">
        <div className="min-w-0">
          <p className="ej-jobs-eyebrow">{jobsL('eyebrow')}</p>
          <h1>{jobsL('title')}</h1>
          <p className="ej-jobs-subtitle">{summary}</p>
        </div>
        <button
          type="button"
          className="ej-jobs-new"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={18} aria-hidden="true" /> {jobsL('newJob')}
        </button>
      </header>

      <label className="ej-jobs-search">
        <Search size={19} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={jobsL('searchPlaceholder')}
          aria-label={jobsL('searchPlaceholder')}
        />
        {query !== '' && (
          <button
            type="button"
            className="ej-jobs-search-clear"
            onClick={() => setQuery('')}
            aria-label={jobsL('clearSearch')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
        <kbd>⌘ K</kbd>
      </label>

      <div className="ej-jobs-filters" role="tablist" aria-label={jobsL('filtersLabel')}>
        {FILTER_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filterId === id}
            className={cn('ej-jobs-filter-tab', filterId === id && 'active')}
            onClick={() => setFilterId(id)}
          >
            <span>{filterLabel(id)}</span>
            <span
              className={cn(
                'ej-jobs-filter-count',
                id === 'late' && (counts[id] ?? 0) > 0 && 'count-late',
              )}
            >
              {counts[id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="ej-jobs-toolbar">
        <span className="ej-jobs-sort-caption">{sortLabels[sort]}</span>
        <div className="ej-jobs-sort-control" ref={sortRef}>
          <button
            type="button"
            className="ej-jobs-sort-button"
            aria-expanded={sortOpen}
            aria-haspopup="menu"
            onClick={() => setSortOpen((v) => !v)}
          >
            <ArrowUpDown size={15} aria-hidden="true" /> {jobsL('sortButton')}
          </button>
          {sortOpen && (
            <div className="ej-jobs-sort-menu" role="menu">
              {(Object.keys(sortLabels) as JobListSort[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sort === key}
                  className={sort === key ? 'chosen' : ''}
                  onClick={() => {
                    setSort(key);
                    setSortOpen(false);
                  }}
                >
                  <span>{sortLabels[key]}</span>
                  {sort === key && <CheckCircle2 size={18} aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="ej-jobs-empty">
          <span className="ej-jobs-empty-icon" aria-hidden="true">
            <EmptyIcon size={23} />
          </span>
          <h2>{empty.title}</h2>
          <p>{empty.text}</p>
          {showClearFilters ? (
            <button
              type="button"
              className="ej-jobs-clear"
              onClick={() => {
                setQuery('');
                setFilterId('all');
              }}
            >
              {jobsL('clearFilters')}
            </button>
          ) : (
            <button
              type="button"
              className="ej-jobs-new"
              onClick={() => setModalOpen(true)}
            >
              {jobsL('createFirstJob')}
            </button>
          )}
        </div>
      ) : (
        <div className="ej-jobs-groups">
          {visible.map((group) => (
            <section className="ej-jobs-group" key={group.id} aria-label={group.heading}>
              <div className="ej-jobs-group-heading">
                <h2 className={group.headingTone === 'danger' ? 'tone-danger' : ''}>
                  {group.heading}
                </h2>
                {group.headingMeta && <span>{group.headingMeta}</span>}
              </div>
              <div className="ej-jobs-list">
                {group.rows.map((r) => (
                  <Link key={r.id} href={`/jobs/${r.id}`} className="ej-jobs-card">
                    <span className="ej-jobs-card-icon">{tradeIconNode(r.tradeKey)}</span>
                    <span className="ej-jobs-card-info">
                      <b>{r.title}</b>
                      <span>
                        {r.address ? `${r.customerName}, ${r.address}` : r.customerName}
                      </span>
                      <small>
                        <Clock3 size={12} aria-hidden="true" />
                        {metaLine(r)}
                        {r.address && (
                          <>
                            <i className="ej-jobs-card-dot" aria-hidden="true" />
                            <MapPin size={11} aria-hidden="true" />
                            {r.address}
                          </>
                        )}
                      </small>
                      <span className="ej-jobs-card-badges">{metaBadges(r)}</span>
                    </span>
                    <span className="ej-jobs-card-value">
                      {formatCompactCAD(r.priceCents, r.noCharge)}
                    </span>
                    <span className="ej-jobs-card-open" aria-hidden="true">
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {modalOpen && (
        <NewJobModal
          customers={customers}
          crews={crews}
          locale={locale}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
