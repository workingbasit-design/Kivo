import type { ReactNode } from 'react';
import type { IconComponent } from '@/components/icons';

export interface KeyValueRowProps {
  icon: IconComponent;
  label: string;
  sub?: string;
  action?: ReactNode;
}

/**
 * Icon + label/sub + right-side action (mockup `.kv2`).
 */
export function KeyValueRow({ icon: Icon, label, sub, action }: KeyValueRowProps) {
  return (
    <div
      data-kit="key-value-row"
      className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-t border-line first:border-t-0"
    >
      <Icon size={22} aria-hidden="true" className="text-ink-2" />
      <div className="min-w-0">
        <b className="block font-semibold text-ink">{label}</b>
        {sub && (
          <span className="block text-[14px] text-ink-2">{sub}</span>
        )}
      </div>
      {action}
    </div>
  );
}
