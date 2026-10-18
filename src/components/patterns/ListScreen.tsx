import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import {
  PageHeader,
  SearchField,
  FilterChips,
  ListRow,
  EmptyState,
} from '@/components/kit';
import type {
  FilterChip,
  EmptyStateProps,
  ListRowProps,
} from '@/components/kit';
import { computeFilterCounts, visibleGroupsForFilter } from './list-logic';

export interface ListScreenRow extends ListRowProps {
  /** Stable key for the row. */
  rowKey: string;
  /** Filter ids this row belongs to; must include 'all'. */
  filterIds: string[];
}

export interface ListScreenGroup {
  id: string;
  heading: string;
  /** Small muted meta next to the heading, e.g. "4 jobs". */
  headingMeta?: string;
  headingTone?: 'default' | 'danger';
  rows: ListScreenRow[];
}

export interface ListScreenFilter {
  id: string;
  label: string;
  tone?: 'default' | 'danger';
  /** Empty state shown when this filter matches nothing. */
  empty: EmptyStateProps;
}

export interface ListScreenProps {
  title: string;
  summary?: string;
  actionLabel: string;
  actionIcon?: ReactNode;  // rendered element, not the component (see kit PageHeader)
  actionHref?: string;
  onAction?: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  searchClearLabel: string;
  /** Accessible name for the filter-chip group. */
  filtersLabel: string;
  filters: ListScreenFilter[];
  selectedFilterId: string;
  onSelectFilter: (id: string) => void;
  /** Groups are pre-filtered for the search query by the caller; chip counts
   * are computed from these rows, so they always match the list. */
  groups: ListScreenGroup[];
  /** Optional content rendered between the filter chips and the groups
   * (e.g. the Jobs screen's sort row). */
  belowChips?: ReactNode;
}

/**
 * List screen pattern (mockup: Jobs, Customers, Expenses).
 *
 * Header with one hi-vis primary action, search, and filter chips whose
 * counts are computed from the rows (they cannot drift), then a grouped
 * list. Each filter gets its own empty state.
 */
export function ListScreen({
  title,
  summary,
  actionLabel,
  actionIcon,
  actionHref,
  onAction,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  searchClearLabel,
  filtersLabel,
  filters,
  selectedFilterId,
  onSelectFilter,
  groups,
  belowChips,
}: ListScreenProps) {
  const filterIds = filters.map((f) => f.id);
  const counts = computeFilterCounts(groups, filterIds);
  const chips: FilterChip[] = filters.map((f) => ({
    id: f.id,
    label: f.label,
    count: counts[f.id] ?? 0,
    tone: f.tone,
  }));
  const visible = visibleGroupsForFilter(groups, selectedFilterId);
  const activeFilter = filters.find((f) => f.id === selectedFilterId);

  return (
    <div data-pattern="list-screen" className="min-w-0">
      <PageHeader
        title={title}
        summary={summary}
        actionLabel={actionLabel}
        actionIcon={actionIcon}
        actionHref={actionHref}
        onAction={onAction}
      />
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        label={searchLabel}
        clearLabel={searchClearLabel}
      />
      <FilterChips
        chips={chips}
        selectedId={selectedFilterId}
        onSelect={onSelectFilter}
        ariaLabel={filtersLabel}
      />
      {belowChips}
      {visible.length === 0 ? (
        activeFilter && (
          <EmptyState
            icon={activeFilter.empty.icon}
            title={activeFilter.empty.title}
            text={activeFilter.empty.text}
            actionLabel={activeFilter.empty.actionLabel}
            onAction={activeFilter.empty.onAction}
          />
        )
      ) : (
        visible.map((group) => (
          <section key={group.id} aria-label={group.heading}>
            <h2
              className={cn(
                'mx-[2px] mb-2 mt-[18px] flex items-baseline justify-between gap-2 text-[17px] font-bold',
                group.headingTone === 'danger' ? 'text-danger' : 'text-ink',
              )}
            >
              <span>{group.heading}</span>
              {group.headingMeta && (
                <span className="text-[14px] font-semibold text-ink-2">
                  {group.headingMeta}
                </span>
              )}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {group.rows.map((row) => (
                <ListRow
                  key={row.rowKey}
                  icon={row.icon}
                  avatarInitials={row.avatarInitials}
                  title={row.title}
                  subtitle={row.subtitle}
                  meta={row.meta}
                  amount={row.amount}
                  amountCaption={row.amountCaption}
                  amountTone={row.amountTone}
                  href={row.href}
                  onClick={row.onClick}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
