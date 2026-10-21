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

/** Tabs to render in the mobile bottom bar for this viewer. */
export function visibleBottomTabs<T extends BottomTabLike>(
  tabs: readonly T[],
  showMoney: boolean,
): T[] {
  return showMoney ? [...tabs] : tabs.filter((tab) => tab.href !== MONEY_TAB_HREF);
}
