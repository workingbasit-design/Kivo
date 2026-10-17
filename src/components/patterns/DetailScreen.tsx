import type { ReactNode } from 'react';
import type { IconComponent } from '@/components/icons';
import { TopBar, Card, StickyActionBar, StatusBadge } from '@/components/kit';
import type { TopBarAction, StatusBadgeProps } from '@/components/kit';

export interface DetailSection {
  /** Section heading rendered above the card; omit for an unlabeled card. */
  title?: string;
  content: ReactNode;
}

export interface DetailScreenProps {
  backLabel: string;
  onBack: () => void;
  topActions?: TopBarAction[];
  icon: IconComponent;
  title: string;
  subtitle?: string;
  badges?: StatusBadgeProps[];
  /** Cards in the fixed mockup order. Undefined sections are skipped. */
  whenWhere?: DetailSection;
  who?: DetailSection;
  whatsNext?: DetailSection;
  money?: DetailSection;
  notesPhotos?: DetailSection;
  history?: DetailSection;
  /** Sticky action bar: the primary button is the one next step. */
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Detail screen pattern (mockup: Job detail, Invoice detail, Customer detail).
 *
 * Back top bar, icon + title + status badges, then cards in the fixed order:
 * when and where, who, what's next, money, notes and photos, history.
 * A sticky action bar holds the one next step; the tab bar is hidden on
 * detail screens by the app chrome, not by this pattern.
 */
export function DetailScreen({
  backLabel,
  onBack,
  topActions,
  icon: Icon,
  title,
  subtitle,
  badges,
  whenWhere,
  who,
  whatsNext,
  money,
  notesPhotos,
  history,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: DetailScreenProps) {
  const sections: DetailSection[] = [
    whenWhere,
    who,
    whatsNext,
    money,
    notesPhotos,
    history,
  ].filter((s): s is DetailSection => s != null);

  return (
    <div data-pattern="detail-screen" className="min-w-0">
      <TopBar
        variant="back"
        backLabel={backLabel}
        onBack={onBack}
        actions={topActions}
      />
      <div className="flex items-center gap-3 px-0 pb-2.5 pt-1.5">
        <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl border border-line bg-surface text-ink">
          <Icon size={28} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="m-0 text-[26px] font-bold leading-[1.1] tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mb-0 mt-[3px] text-[15px] text-ink-2">{subtitle}</p>
          )}
        </div>
      </div>
      {badges && badges.length > 0 && (
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {badges.map((badge, i) => (
            <StatusBadge key={i} tone={badge.tone} icon={badge.icon}>
              {badge.children}
            </StatusBadge>
          ))}
        </div>
      )}
      {sections.map((section, i) => (
        <section key={i}>
          {section.title && (
            <div className="mx-[2px] mb-2 mt-5 flex items-baseline justify-between">
              <h2 className="m-0 text-[18px] font-bold text-ink">
                {section.title}
              </h2>
            </div>
          )}
          <Card className={section.title ? 'px-3.5 py-1' : 'mt-3 px-3.5 py-1'}>
            {section.content}
          </Card>
        </section>
      ))}
      <StickyActionBar
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        secondaryLabel={secondaryLabel}
        onSecondary={onSecondary}
      />
    </div>
  );
}
