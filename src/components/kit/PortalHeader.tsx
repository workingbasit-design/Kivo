'use client';

import { cn } from '@/lib/utils';

export type PortalLang = 'en' | 'fr';

export interface PortalHeaderProps {
  businessInitial: string;
  businessName: string;
  areaLabel: string;
  lang: PortalLang;
  onLangChange: (lang: PortalLang) => void;
}

const LANGS: Array<{ code: PortalLang; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

/**
 * Customer-facing portal header mirroring the mockup's `.p-head`:
 * business logo block (initial, brand bg), business name, area line,
 * and an EN/FR language switch.
 */
export function PortalHeader({
  businessInitial,
  businessName,
  areaLabel,
  lang,
  onLangChange,
}: PortalHeaderProps) {
  return (
    <header
      data-kit="portal-header"
      className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-0 py-1 pb-4"
    >
      <span
        className="grid h-12 w-12 flex-none place-items-center rounded-[14px] bg-biz text-[22px] font-bold text-surface"
        aria-hidden="true"
      >
        {businessInitial}
      </span>
      <div className="min-w-0">
        <b className="block truncate text-[18px] leading-[1.2]">{businessName}</b>
        <span className="block truncate text-[14px] text-ink-2">{areaLabel}</span>
      </div>
      <div
        role="group"
        className="inline-flex rounded-[12px] bg-surface-2 p-[3px] shadow-[inset_0_0_0_1px_var(--line)]"
      >
        {LANGS.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            aria-pressed={lang === code}
            onClick={() => onLangChange(code)}
            className={cn(
              'min-h-[44px] min-w-[44px] rounded-[9px] font-bold text-ink-2',
              'focus-visible:outline-2 focus-visible:outline-focus',
              lang === code && 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}
