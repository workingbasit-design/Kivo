import type { ReactNode } from 'react';

export interface KeyValueRowProps {
  icon: ReactNode; // rendered element, not the component (see kit PageHeader)
  label: string;
  sub?: string;
  action?: ReactNode;
}

/**
 * Icon + label/sub + right-side action (mockup `.kv2`).
 */
export function KeyValueRow({ icon, label, sub, action }: KeyValueRowProps) {
  return (
    <div
      data-kit="key-value-row"
      className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-t border-line first:border-t-0"
    >
      <span aria-hidden="true" className="inline-flex text-ink-2 [&_svg]:size-[22px]">{icon}</span>
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
