/**
 * Shared money display (Part B8). One formatter for every amount so
 * amounts line up and always render as CAD with tabular figures.
 */
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export default function MoneyText({
  cents,
  locale = 'en',
  className,
}: {
  cents: bigint | number;
  locale?: 'en' | 'fr';
  className?: string;
}) {
  return <span className={cn('tabular-nums', className)}>{formatCents(cents, 'CAD', locale)}</span>;
}
