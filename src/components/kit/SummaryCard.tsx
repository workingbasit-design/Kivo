import { cn } from '@/lib/utils';

export interface SummaryStat {
  label: string;
  value: string;
  sub?: string;
}

export interface SummaryCardProps {
  stats: SummaryStat[];
}

/**
 * Two- or three-column stat card (mockup `.sumcard`): 2 columns by default,
 * 3 when three stats are given.
 */
export function SummaryCard({ stats }: SummaryCardProps) {
  const three = stats.length >= 3;

  return (
    <div
      data-kit="summary-card"
      className={cn(
        'grid gap-3 p-3.5 rounded-2xl bg-surface border border-line',
        three ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <span className="block text-[14px] text-ink-2 font-semibold">
            {stat.label}
          </span>
          <span
            className={cn(
              'num font-bold leading-[1.1] text-ink',
              three ? 'text-[24px]' : 'text-[28px]',
            )}
          >
            {stat.value}
          </span>
          {stat.sub && (
            <small className="block text-[13px] text-ink-2 mt-[3px] leading-[1.3]">
              {stat.sub}
            </small>
          )}
        </div>
      ))}
    </div>
  );
}
