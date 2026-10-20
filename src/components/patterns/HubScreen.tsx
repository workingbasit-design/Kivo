import type { ReactNode } from 'react';
import { PageHeader, SegmentedControl } from '@/components/kit';
import type { SegmentedOption } from '@/components/kit';

export interface HubScreenProps {
  title: string;
  summary?: string;
  actionLabel: string;
  actionIcon?: ReactNode;  // rendered element, not the component (see kit PageHeader)
  actionHref?: string;
  onAction?: () => void;
  /** Segmented views; the first one is the default ("To do"). */
  views: SegmentedOption[];
  selectedViewId: string;
  onSelectView: (id: string) => void;
  /** Accessible name for the views group. */
  viewsLabel: string;
  /** The active view's content. */
  children: ReactNode;
}

/**
 * Hub screen pattern (mockup: Money).
 *
 * Page header with one hi-vis primary action, then a segmented control of
 * views with the first ("To do") selected by default, then the active view.
 */
export function HubScreen({
  title,
  summary,
  actionLabel,
  actionIcon,
  actionHref,
  onAction,
  views,
  selectedViewId,
  onSelectView,
  viewsLabel,
  children,
}: HubScreenProps) {
  return (
    <div data-pattern="hub-screen" className="min-w-0">
      <PageHeader
        title={title}
        summary={summary}
        actionLabel={actionLabel}
        actionIcon={actionIcon}
        actionHref={actionHref}
        onAction={onAction}
      />
      <SegmentedControl
        options={views}
        selectedId={selectedViewId}
        onSelect={onSelectView}
        ariaLabel={viewsLabel}
      />
      {children}
    </div>
  );
}
