import { cn } from '@/lib/utils';

export type SkeletonVariant = 'row' | 'card' | 'list';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

/**
 * Loading skeleton using only `bg-surface-2` + pulse — no colours.
 * Presentational; hidden from assistive tech.
 */
export function Skeleton({ variant = 'row', className }: SkeletonProps) {
  const base = 'motion-safe:animate-pulse bg-surface-2';
  if (variant === 'card') {
    return (
      <div
        data-kit="skeleton"
        aria-hidden="true"
        className={cn(base, 'h-[120px] rounded-2xl', className)}
      />
    );
  }
  if (variant === 'list') {
    return (
      <div data-kit="skeleton" aria-hidden="true" className={cn('grid gap-3', className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn(base, 'h-[68px] rounded-2xl')} />
        ))}
      </div>
    );
  }
  return (
    <div
      data-kit="skeleton"
      aria-hidden="true"
      className={cn(base, 'h-[68px] rounded-2xl', className)}
    />
  );
}
