/**
 * Pure bottom-nav logic (no imports, unit-testable under node --test —
 * nav-sections.ts itself pulls in icon components).
 *
 * The Money tab (/money) is a price surface: viewers whose role lacks
 * SEE_PRICES (technicians) must not see it. Everything else is unchanged.
 */

export interface BottomTabLike {
  href: string;
}

export const MONEY_TAB_HREF = '/money';

/**
 * Whether a bottom tab reads as active on this pathname.
 *
 * The morning-briefing page (/digest) is the Today view: the Today tab
 * (/dashboard) reads as active there so the hi-vis pill shows instead of
 * all five tabs sitting muted grey.
 */
export function isTabActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(href + '/')) return true;
  if (href === '/dashboard' && (pathname === '/digest' || pathname.startsWith('/digest/'))) {
    return true;
  }
  return false;
}

/** Tabs to render in the mobile bottom bar for this viewer. */
export function visibleBottomTabs<T extends BottomTabLike>(
  tabs: readonly T[],
  showMoney: boolean,
): T[] {
  return showMoney ? [...tabs] : tabs.filter((tab) => tab.href !== MONEY_TAB_HREF);
}
