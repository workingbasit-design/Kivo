'use client';

import type { IconComponent } from '@/components/icons';
import { ChevronLeft } from '@/components/icons';

export interface TopBarAction {
  icon: IconComponent;
  /** Accessible name for the icon-only button. */
  label: string;
  /** Optional count pill (e.g. unread notifications). */
  badge?: number | string;
  onClick: () => void;
}

export interface TopBarProps {
  variant: 'brand' | 'back';
  /** Brand variant: business/product name shown next to the logo mark. */
  brandName?: string;
  /** Back variant: label next to the back chevron. */
  backLabel?: string;
  /** Back variant: back handler. */
  onBack?: () => void;
  /** Right-side icon actions. */
  actions?: TopBarAction[];
}

/**
 * Sticky top bar. Brand variant shows the logo mark + name; back variant
 * shows a back button with label. Right side takes icon actions with
 * optional count badges.
 */
export function TopBar({ variant, brandName, backLabel, onBack, actions = [] }: TopBarProps) {
  return (
    <header
      data-kit="top-bar"
      className="sticky top-[env(safe-area-inset-top,0px)] z-30 bg-topbar"
    >
      <div className="mx-auto flex min-h-[60px] w-full max-w-[480px] items-center gap-0.5 px-4 py-2 pl-4">
        {variant === 'back' ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="-ml-1.5 inline-flex min-h-[44px] items-center gap-0.5 rounded-xl pr-3 font-semibold text-[17px] text-ink focus-visible:outline-2 focus-visible:outline-focus"
          >
            <ChevronLeft size={22} aria-hidden />
            <span>{backLabel}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 text-[21px] font-bold tracking-[-0.2px]">
            <span
              aria-hidden
              className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-asphalt"
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] text-hivis" aria-hidden>
                <rect x="6" y="4.5" width="12.5" height="3.4" rx="1.3" fill="currentColor" />
                <rect x="6" y="10.3" width="9.5" height="3.4" rx="1.3" fill="currentColor" />
                <rect x="6" y="16.1" width="12.5" height="3.4" rx="1.3" fill="currentColor" />
                <rect x="6" y="4.5" width="3.4" height="15" rx="1.3" fill="currentColor" />
              </svg>
            </span>
            <span>{brandName}</span>
          </div>
        )}
        <span className="flex-1" aria-hidden />
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              aria-label={action.label}
              className="relative grid h-11 w-11 place-items-center rounded-xl text-ink focus-visible:outline-2 focus-visible:outline-focus"
            >
              <ActionIcon size={24} aria-hidden />
              {action.badge != null && (
                <span
                  aria-hidden
                  className="absolute right-1 top-[5px] grid h-[19px] min-w-[19px] place-items-center rounded-[10px] border-2 border-topbar bg-danger px-[5px] text-[12px] font-bold text-surface"
                >
                  {action.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}

export default TopBar;
