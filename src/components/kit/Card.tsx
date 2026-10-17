import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

/**
 * Panel container (mockup `.panel` / `.card`): surface, 1px line border,
 * 2xl rounding, kit card elevation. Padding is left to the caller so the
 * same shell can wrap headers, rows or bare content.
 */
export function Card({ children, className, labelledBy }: CardProps) {
  return (
    <div
      data-kit="card"
      aria-labelledby={labelledBy}
      className={cn(
        'bg-surface border border-line rounded-2xl shadow-kit-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
