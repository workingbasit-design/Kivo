import { StatusBadge, type StatusBadgeProps } from '@/components/kit';
import { statusLabel } from '@/lib/utils';
import { jobStatusLabel } from '@/lib/job-status';
import type { Locale } from '@/lib/i18n';

/** Map a domain status to a kit StatusBadge tone. */
export function statusTone(status: string): StatusBadgeProps['tone'] {
  const s = status.replace(/_/g, ' ');
  if (s === 'COMPLETED' || s === 'PAID' || s === 'APPROVED' || s === 'ACCEPTED')
    return 'done';
  if (s === 'IN PROGRESS' || s === 'SENT' || s === 'NEW' || s === 'ACTIVE')
    return 'info';
  if (
    s === 'CANCELLED' ||
    s === 'VOID' ||
    s === 'VOIDED' ||
    s === 'DECLINED' ||
    s === 'EXPIRED' ||
    s === 'ARCHIVED' ||
    s === 'DRAFT'
  )
    return 'neutral';
  if (s === 'OVERDUE' || s === 'LATE') return 'late';
  return 'scheduled';
}

/**
 * Status pill: the old ui StatusBadge's label resolution (i18n `statuses`
 * dictionary, then the job-status labels) rendered with the kit StatusBadge.
 */
export function StatusPill({
  status,
  locale = 'en',
}: {
  status: string;
  locale?: Locale;
}) {
  const normalized = status.replace(/_/g, ' ');
  const dictLabel = statusLabel(normalized, locale);
  const label = dictLabel !== normalized ? dictLabel : jobStatusLabel(normalized, locale);
  return <StatusBadge tone={statusTone(status)}>{label}</StatusBadge>;
}
