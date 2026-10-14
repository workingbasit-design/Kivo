/**
 * Shared money display (Part B8). One formatter for every amount so
 * amounts line up and always render as CAD with tabular figures.
 *
 * Pass EITHER `cents` (integer cents, e.g. from a *Cents column) OR
 * `dollars` (Float dollars, e.g. a legacy `price` field). Both format
 * through the same CAD formatter, so output is identical to formatMoney.
 */
import { formatCents, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export default function MoneyText({
  cents,
  dollars,
  locale = 'en',
  className,
}: {
  /** Integer cents (BigInt). Preferred for new code. */
  cents?: bigint | number;
  /** Float dollars (legacy fields). Use while the cents migration completes. */
  dollars?: number | null;
  locale?: 'en' | 'fr';
  className?: string;
}) {
  const text =
    dollars !== undefined && dollars !== null
      ? formatMoney(dollars, 'CAD', locale)
      : formatCents(cents ?? 0, 'CAD', locale);
  return <span className={cn('tabular-nums', className)}>{text}</span>;
}
