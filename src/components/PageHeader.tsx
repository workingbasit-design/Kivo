/**
 * Shared page header (Part B8). Title plus actions, with an optional back
 * link. Thin wrapper over the `PageHeader` in `./ui` so there is a single
 * visual implementation; this file is the spec'd entry point
 * ({ title, actions, backHref }).
 */
import Link from 'next/link';
import { ChevronLeft } from '@/components/icons';
import { PageHeader as UiPageHeader } from './ui';

export default function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel = 'Back',
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div>
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900"
        >
          <ChevronLeft size={16} />
          {backLabel}
        </Link>
      )}
      <UiPageHeader title={title} subtitle={subtitle} actions={actions} />
    </div>
  );
}
