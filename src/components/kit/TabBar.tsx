'use client';

import type { IconComponent } from '@/components/icons';
import { Sun } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface TabBarTab {
  id: string;
  label: string;
  /** Icon component. The today tab must use `Sun` with weight="regular"
   *  (the filled sun reads as a gear); TabBar always renders icons outlined. */
  icon: IconComponent;
  href: string;
  badge?: number | string;
}

export interface TabBarProps {
  tabs: TabBarTab[];
  activeId: string;
  /** Accessible name for the navigation landmark. */
  ariaLabel: string;
}

/**
 * Fixed bottom tab bar. The active tab gets a lime pill behind its icon
 * (`bg-hivis`) and the active label colour (`text-nav-active`); inactive
 * tabs render in `text-nav-ink`. All icons render outlined at 24px — never
 * duotone/fill.
 */
export function TabBar({ tabs, activeId, ariaLabel }: TabBarProps) {
  return (
    <nav
      data-kit="tab-bar"
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-20 bg-nav pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="mx-auto grid w-full max-w-[480px] grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.id === 'today' ? Sun : tab.icon;
          const active = tab.id === activeId;
          return (
            <a
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[64px] flex-col items-center justify-center gap-[3px] text-[12px] font-semibold no-underline',
                active ? 'text-nav-active' : 'text-nav-ink',
                'focus-visible:outline-2 focus-visible:outline-focus'
              )}
            >
              <span
                className={cn(
                  'relative grid h-[30px] w-[46px] place-items-center rounded-[10px]',
                  active && 'bg-hivis text-hivis-ink'
                )}
              >
                <Icon size={24} weight="regular" aria-hidden />
                {tab.badge != null && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-surface"
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export default TabBar;
