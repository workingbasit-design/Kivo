import type { IconComponent } from '@/components/icons';
import { formatCAD } from './money';

export interface ProjectCardMetaLabels {
  contract: string;
  invoiced: string;
  next: string;
}

export interface ProjectCardProps {
  icon: IconComponent;
  title: string;
  sub: string;
  progressPct: number;
  phaseLabel: string;
  /** Accessible label for the progress bar; defaults to `phaseLabel`. */
  progressLabel?: string;
  contractCents: number;
  invoicedCents: number;
  nextLabel: string;
  metaLabels: ProjectCardMetaLabels;
}

/**
 * Project card mirroring the mockup's `.proj`: icon, title, sub,
 * progress bar (with proper ARIA), phase label + pct, and
 * contract / invoiced / next meta. Presentational.
 */
export function ProjectCard({
  icon: Icon,
  title,
  sub,
  progressPct,
  phaseLabel,
  progressLabel,
  contractCents,
  invoicedCents,
  nextLabel,
  metaLabels,
}: ProjectCardProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
  return (
    <article
      data-kit="project-card"
      className="rounded-2xl border border-line bg-surface p-[14px] shadow-kit-card"
    >
      <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--line)]">
          <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <b className="block text-[17px] leading-[1.25]">{title}</b>
          <span className="block truncate text-[14px] text-ink-2">{sub}</span>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={progressLabel ?? phaseLabel}
        className="mt-[14px] mb-[6px] h-[10px] overflow-hidden rounded-[5px] bg-line"
      >
        <span className="block h-full bg-chart-a" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[14px] font-semibold text-ink-2">
        <span>{phaseLabel}</span>
        <span className="num text-ink">{pct}%</span>
      </div>
      <dl className="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 border-t border-line pt-3">
        <div>
          <dt className="text-[13px] text-ink-2">{metaLabels.contract}</dt>
          <dd className="num m-0 text-[19px] font-bold">{formatCAD(contractCents)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-ink-2">{metaLabels.invoiced}</dt>
          <dd className="num m-0 text-[19px] font-bold">{formatCAD(invoicedCents)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-ink-2">{metaLabels.next}</dt>
          <dd className="m-0 text-[19px] font-bold">{nextLabel}</dd>
        </div>
      </dl>
    </article>
  );
}
