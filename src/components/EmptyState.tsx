/**
 * Shared empty state (Part B5).
 *
 * One clear message + one next action. Use when a screen has nothing to
 * show, instead of repeating "nothing here" lines across cards.
 *
 * This is intentionally a separate, minimal component from the
 * `EmptyState` in `@/components/ui` (which takes an `action` ReactNode):
 * this one takes a single labelled link so every empty state in the app
 * has exactly one obvious next step.
 */
import Link from 'next/link';
import { primaryBtnClass } from '@/components/ui';

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  /** Single next action. Omit both to render no action. */
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 md:p-16 text-center">
      {icon && <div className="mb-4 text-ink-2">{icon}</div>}
      <h3 className="text-base font-bold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-2 max-w-sm mb-6">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={primaryBtnClass}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
