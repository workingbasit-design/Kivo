/**
 * Shared job status badge (Part A1, consolidated in Part B8).
 *
 * Renders the status pill in sentence case (never SCREAMING_CASE) plus a
 * separate "Late" badge when the job is past-due. Use everywhere a status
 * is shown so filters, lists, and detail pages agree.
 *
 * Labels resolve through the i18n `statuses` dictionary first (covers job,
 * quote, invoice, and lead statuses), then the job-status labels, so both
 * spellings ('PARTIALLY PAID' and legacy 'PARTIALLY_PAID') render correctly.
 */
import { jobStatusLabel } from '@/lib/job-status';
import { statusClasses, statusLabel, cn } from '@/lib/utils';

function resolveLabel(status: string, locale: 'en' | 'fr'): string {
  const normalized = status.replace(/_/g, ' ');
  const dictLabel = statusLabel(normalized, locale);
  if (dictLabel !== normalized) return dictLabel;
  return jobStatusLabel(normalized, locale);
}

export default function StatusBadge({
  status,
  isLate = false,
  locale = 'en',
}: {
  status: string;
  isLate?: boolean;
  locale?: 'en' | 'fr';
}) {
  const normalized = status.replace(/_/g, ' ');
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
          statusClasses(normalized),
        )}
      >
        {resolveLabel(status, locale)}
      </span>
      {isLate && (
        <span className="inline-flex items-center rounded-full border border-line bg-danger-bg px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-danger">
          {locale === 'fr' ? 'En retard' : 'Late'}
        </span>
      )}
    </span>
  );
}
