'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Inbox,
  MessageCircle,
  Store,
  User,
  Users,
  Wallet,
  type IconComponent,
} from '@/components/icons';

export type SettingsTab = { id: string; label: string };

/** One icon per group, from the repo's Phosphor set (no new libraries). */
const TAB_ICONS: Record<string, IconComponent> = {
  business: Store,
  money: Wallet,
  communication: MessageCircle,
  scheduling: CalendarDays,
  team: Users,
  account: User,
  support: Inbox,
};

/**
 * Sticky pill tab nav (ChatGPT Settings redesign, prototype
 * `.settings-tabs`): one pill per settings group, scrolling to the group
 * on tap. The active pill follows the group in view (IntersectionObserver)
 * and the tapped pill; the anchor href does the scrolling, so no-JS and
 * reduced-motion users still land on the right group. Active pill uses the
 * kit selected treatment (hivis bg + hivis-ink text), identical in light
 * and dark mode.
 */
export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');

  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(`settings-${t.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id.replace('settings-', ''));
          }
        }
      },
      { rootMargin: '-72px 0px -70% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav data-settings-nav aria-label="Settings sections" className="ej-settings-tabs">
      {tabs.map(({ id, label }) => {
        const Icon = TAB_ICONS[id] ?? Store;
        return (
          <a
            key={id}
            href={`#settings-${id}`}
            aria-current={active === id ? 'true' : undefined}
            onClick={() => setActive(id)}
          >
            <Icon size={14} aria-hidden />
            {label}
          </a>
        );
      })}
    </nav>
  );
}
