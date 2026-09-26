import {
  LayoutDashboard, Calendar, Users, Briefcase, FileText, Wallet,
  Settings, ClipboardList, Tag, Star, PieChart, Sparkles,
  UserPlus, Megaphone, Repeat, Route, BellRing, Timer,
  UserCog, Import, MapPin, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  nameKey: string;
  href: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /**
   * Phase 1: deferred features render under a collapsed "Advanced" group
   * instead of their normal section. The pages and routes stay live; only
   * the navigation surface is reduced so Phase-1 users see a focused menu.
   */
  advanced?: boolean;
}

export interface NavSection {
  labelKey: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    labelKey: 'nav.sections.work',
    items: [
      { nameKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
      { nameKey: 'nav.schedule', href: '/schedule', icon: Calendar },
      { nameKey: 'nav.jobs', href: '/jobs', icon: Briefcase },
      { nameKey: 'nav.recurring', href: '/recurring', icon: Repeat },
      { nameKey: 'nav.routes', href: '/routes', icon: Route, advanced: true },
      { nameKey: 'nav.tracking', href: '/tracking', icon: MapPin, advanced: true },
      { nameKey: 'nav.timesheets', href: '/timesheets', icon: Timer, advanced: true },
    ],
  },
  {
    labelKey: 'nav.sections.money',
    items: [
      { nameKey: 'nav.quotes', href: '/quotes', icon: ClipboardList },
      { nameKey: 'nav.invoices', href: '/invoices', icon: FileText },
    ],
  },
  {
    labelKey: 'nav.sections.customers',
    items: [
      { nameKey: 'nav.leads', href: '/leads', icon: UserPlus },
      { nameKey: 'nav.customers', href: '/customers', icon: Users },
      { nameKey: 'nav.reviews', href: '/reviews', icon: Star },
    ],
  },
  {
    labelKey: 'nav.sections.grow',
    items: [
      { nameKey: 'nav.pricebook', href: '/pricebook', icon: Tag, advanced: true },
      { nameKey: 'nav.marketing', href: '/marketing', icon: Megaphone, advanced: true },
      { nameKey: 'nav.reminders', href: '/reminders', icon: BellRing },
      // Phase 1: online booking is not advertised. The public /book/[slug]
      // pages keep working for links that were already shared; only this
      // nav/settings entry point is removed.
    ],
  },
  {
    labelKey: 'nav.sections.manage',
    items: [
      { nameKey: 'nav.reports', href: '/reports', icon: PieChart },
      { nameKey: 'nav.insights', href: '/insights', icon: Sparkles, advanced: true },
      { nameKey: 'nav.imports', href: '/imports', icon: Import },
      { nameKey: 'nav.team', href: '/settings/team', icon: UserCog },
      { nameKey: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
];

/** All deferred items, gathered across sections for the Advanced group. */
export const advancedNavItems: NavItem[] = navSections.flatMap((s) =>
  s.items.filter((i) => i.advanced),
);

/** Badge keys for nav items that can show a count (desktop sidebar). */
export const navBadgeKeys: Record<string, string> = {
  '/leads': 'leads',
};

/** Primary thumb-reachable tabs for the mobile bottom bar (More is 5th, rendered separately). */
export const bottomTabs: NavItem[] = [
  { nameKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'nav.schedule', href: '/schedule', icon: Calendar },
  { nameKey: 'nav.jobs', href: '/jobs', icon: Briefcase },
  { nameKey: 'nav.money', href: '/money', icon: Wallet },
];
