'use client';

import { cn } from '@/lib/utils';

export interface PaymentMethodOption {
  id: string;
  title: string;
  sub?: string;
  recommended?: boolean;
}

export interface PaymentMethodChoicesProps {
  methods: PaymentMethodOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Label for the "recommended" tag; tag hidden when omitted. */
  recommendedLabel?: string;
}

/**
 * Radio list of payment methods mirroring the mockup's `.paym`/`.popt`,
 * with an optional "recommended" tag on individual methods.
 */
export function PaymentMethodChoices({
  methods,
  selectedId,
  onSelect,
  recommendedLabel,
}: PaymentMethodChoicesProps) {
  return (
    <div data-kit="payment-method-choices" role="radiogroup" className="grid gap-2">
      {methods.map((method) => {
        const checked = method.id === selectedId;
        return (
          <button
            key={method.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onSelect(method.id)}
            className={cn(
              'grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border-[1.5px] border-line-strong bg-surface p-[14px] text-left',
              'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
              checked && 'border-ink shadow-[inset_0_0_0_1px_var(--ink)]',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-[22px] w-[22px] rounded-full border-2 border-line-strong bg-surface',
                checked && 'border-[7px] border-ink',
              )}
            />
            <span className="min-w-0">
              <b className="block truncate text-ink">{method.title}</b>
              {method.sub != null ? (
                <span className="block truncate text-[14px] text-ink-2">{method.sub}</span>
              ) : null}
            </span>
            {method.recommended === true && recommendedLabel != null ? (
              <span className="rounded-[10px] bg-ok-bg px-2 py-[3px] text-[12px] font-bold whitespace-nowrap text-ok">
                {recommendedLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
