/**
 * Shared job status badge (Part A1).
 *
 * Renders the status pill in sentence case (never SCREAMING_CASE) plus a
 * separate "Late" badge when the job is past-due. Use everywhere a job
 * status is shown so filters, lists, and detail pages agree.
 */
import { jobStatusLabel } from '@/lib/job-status';
import { statusClasses, cn } from '@/lib/utils';

export default function StatusBadge({
  status,
  isLate = false,
  locale = 'en',
}: {
  status: string;
  isLate?: boolean;
  locale?: 'en' | 'fr';
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
          statusClasses(status),
        )}
      >
        {jobStatusLabel(status, locale)}
      </span>
      {isLate && (
        <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-red-800">
          {locale === 'fr' ? 'En retard' : 'Late'}
        </span>
      )}
    </span>
  );
}
