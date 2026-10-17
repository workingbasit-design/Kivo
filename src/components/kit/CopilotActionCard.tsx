'use client';

import type { IconComponent } from '@/components/icons';
import { kitButtonClass } from './kit-button';

export interface CopilotActionCardProps {
  icon: IconComponent;
  title: string;
  text: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Copilot action card mirroring the mockup's `.actcard`:
 * icon + title, descriptive text, primary + optional secondary buttons.
 */
export function CopilotActionCard({
  icon: Icon,
  title,
  text,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: CopilotActionCardProps) {
  return (
    <div
      data-kit="copilot-action-card"
      className="self-stretch rounded-2xl border-[1.5px] border-line-strong bg-surface p-[14px] shadow-kit-card"
    >
      <div className="flex items-center gap-2 font-bold text-ink">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span>{title}</span>
      </div>
      <p className="my-1.5 mb-3 text-[15px] text-ink-2">{text}</p>
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
        <button
          type="button"
          className={kitButtonClass('primary', { sm: true })}
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
        {secondaryLabel != null ? (
          <button
            type="button"
            className={kitButtonClass('secondary', { sm: true })}
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
