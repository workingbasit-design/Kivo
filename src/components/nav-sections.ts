import {
  LayoutDashboard, Calendar, Users, Briefcase, FileText,
  Settings, ClipboardList, Tag, Star, PieChart, Sparkles,
  UserPlus, Megaphone, Repeat, Route, CalendarCheck, BellRing, Timer,
  UserCog, Import,
} from 'lucide-react';

export const navSections = [
  {
    labelKey: 'nav.sections.work',
    items: [
      { nameKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
      { nameKey: 'nav.schedule', href: '/schedule', icon: Calendar },
      { nameKey: 'nav.jobs', href: '/jobs', icon: Briefcase },
      { nameKey: 'nav.recurring', href: '/recurring', icon: Repeat },
      { nameKey: 'nav.routes', href: '/routes', icon: Route },
      { nameKey: 'nav.timesheets', href: '/timesheets', icon: Timer },
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
      { nameKey: 'nav.pricebook', href: '/pricebook', icon: Tag },
      { nameKey: 'nav.marketing', href: '/marketing', icon: Megaphone },
      { nameKey: 'nav.reminders', href: '/reminders', icon: BellRing },
      { nameKey: 'nav.onlineBooking', href: '/settings/booking', icon: CalendarCheck },
    ],
  },
  {
    labelKey: 'nav.sections.manage',
    items: [
      { nameKey: 'nav.reports', href: '/reports', icon: PieChart },
      { nameKey: 'nav.insights', href: '/insights', icon: Sparkles },
      { nameKey: 'nav.imports', href: '/imports', icon: Import },
      { nameKey: 'nav.team', href: '/settings/team', icon: UserCog },
      { nameKey: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
];

/** Badge keys for nav items that can show a count (desktop sidebar). */
export const navBadgeKeys: Record<string, string> = {
  '/leads': 'leads',
};

/** Primary thumb-reachable tabs for the mobile bottom bar. */
export const bottomTabs = [
  { nameKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nameKey: 'nav.schedule', href: '/schedule', icon: Calendar },
  { nameKey: 'nav.jobs', href: '/jobs', icon: Briefcase },
  { nameKey: 'nav.customers', href: '/customers', icon: Users },
];
