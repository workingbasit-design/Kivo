import type { ReactNode } from 'react';
import { PortalHeader, formatCAD, kitButtonClass } from '@/components/kit';
import type { PortalLang } from '@/components/kit';

export interface CustomerPageProps {
  businessInitial: string;
  businessName: string;
  areaLabel: string;
  lang: PortalLang;
  onLangChange: (lang: PortalLang) => void;
  title: string;
  intro?: ReactNode;
  /** A clear, prominent total (e.g. invoice balance, quote total). */
  totalLabel: string;
  totalCents: number;
  children: ReactNode;
  /** The one primary action. */
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** e.g. "Powered by EveryJob". */
  poweredByLabel: string;
}

/**
 * Customer-facing page pattern (mockup: public profile, quote approval,
 * invoice payment).
 *
 * Business brand header with a language switch, title, content, a clear
 * total, one primary action (plus an optional secondary), and the
 * "Powered by EveryJob" footer.
 */
export function CustomerPage({
  businessInitial,
  businessName,
  areaLabel,
  lang,
  onLangChange,
  title,
  intro,
  totalLabel,
  totalCents,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  poweredByLabel,
}: CustomerPageProps) {
  return (
    <div data-pattern="customer-page" className="min-w-0">
      <PortalHeader
        businessInitial={businessInitial}
        businessName={businessName}
        areaLabel={areaLabel}
        lang={lang}
        onLangChange={onLangChange}
      />
      <h1 className="m-0 text-[26px] font-bold leading-[1.15] tracking-tight text-ink">
        {title}
      </h1>
      {intro && <div className="mb-3.5 mt-1 text-[16px] text-ink-2">{intro}</div>}
      {children}
      <div className="mt-4">
        <p className="mb-1 text-[15px] font-semibold text-ink-2">{totalLabel}</p>
        <p className="num m-0 text-[44px] font-bold leading-none text-ink">
          {formatCAD(totalCents)}
        </p>
      </div>
      <div className="mt-4 grid gap-2.5">
        <button
          type="button"
          onClick={onPrimary}
          className={kitButtonClass('primary', { block: true })}
        >
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            className={kitButtonClass('ghost', { block: true })}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
      <p className="mb-0 mt-5 text-center text-[13px] text-ink-2">
        {poweredByLabel}
      </p>
    </div>
  );
}
