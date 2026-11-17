import type { ReactNode } from 'react';

export interface PageTitleProps {
  title: string;
  /** Secondary summary line under the title (the kit PageHeader `summary`). */
  summary?: ReactNode;
  /** Small caps kicker above the title (prototype `.eyebrow`). */
  eyebrow?: string;
}

/**
 * Page head without a primary action: the same 28px bold h1 + secondary
 * summary line as the kit PageHeader, for pages that have no hi-vis
 * action. Token classes only — mirrors kit PageHeader's title block.
 */
export function PageTitle({ title, summary, eyebrow }: PageTitleProps) {
  return (
    <header className="px-0 pb-[14px] pt-1.5">
      {eyebrow != null && (
        <p className="mb-[5px] text-[11px] font-extrabold uppercase tracking-[0.13em] text-ink-2">
          {eyebrow}
        </p>
      )}
      <h1 className="m-0 text-[28px] font-bold leading-[1.1] tracking-tight text-ink">
        {title}
      </h1>
      {summary != null && (
        <p className="mb-0 mt-[5px] text-[16px] text-ink-2">{summary}</p>
      )}
    </header>
  );
}
