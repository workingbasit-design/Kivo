'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, Info } from '@/components/icons';

export type BannerTone = 'warn' | 'info';

export interface BannerProps {
  tone: BannerTone;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const toneConfig: Record<
  BannerTone,
  { root: string; icon: string; Icon: typeof AlertTriangle }
> = {
  warn: {
    root: 'bg-warn-bg border border-warn-line',
    icon: 'text-warn-text',
    Icon: AlertTriangle,
  },
  info: {
    root: 'bg-info-bg border border-transparent',
    icon: 'text-info',
    Icon: Info,
  },
};

/**
 * Warning / info banner (mockup `.banner`): icon, bold title, text,
 * optional action button (mockup `.minibtn`).
 */
export function Banner({ tone, title, text, actionLabel, onAction }: BannerProps) {
  const { root, icon, Icon } = toneConfig[tone];

  return (
    <div
      data-kit="banner"
      className={cn(
        'grid grid-cols-[26px_minmax(0,1fr)_auto] gap-2.5 items-center',
        'p-[11px] pl-3.5 rounded-[14px]',
        root,
      )}
    >
      <Icon size={24} aria-hidden="true" className={icon} />
      <div className="min-w-0">
        <b className="block text-ink">{title}</b>
        <span className="block text-[14px] text-ink-2">{text}</span>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            'min-h-[44px] px-3 rounded-xl bg-surface-2 text-ink',
            'font-semibold text-[14px] ring-1 ring-inset ring-line',
            'whitespace-nowrap inline-flex items-center cursor-pointer',
            'focus-visible:outline-2 focus-visible:outline-focus',
          )}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
