'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Select } from '@/components/kit';
import {
  taxSelections,
  type TaxSelection,
} from '@/lib/tax-select';
import type { Locale } from '@/lib/i18n';

export type { TaxSelection };
export { defaultTaxSelection } from '@/lib/tax-select';

export interface TaxSelectProps {
  locale?: Locale;
  /** Field label (localised by the caller). */
  label: ReactNode;
  value: TaxSelection;
  onChange: (selection: TaxSelection) => void;
  className?: string;
}

/**
 * The one tax control for the invoice and quote builders: a single Select
 * of real Canadian rates, defaulting to the business province's rate.
 * No free-typed percentages. The caller submits `value.taxType` /
 * `value.taxRate` as hidden fields; the server recomputes through the
 * shared calcTax/splitStoredTax, so the previewed total is the stored total.
 */
export function TaxSelect({
  locale = 'en',
  label,
  value,
  onChange,
  className,
}: TaxSelectProps) {
  const options = useMemo(() => taxSelections(locale), [locale]);
  return (
    <Select
      label={label}
      className={className}
      value={value.id}
      onChange={(e) => {
        const sel = options.find((o) => o.id === e.target.value);
        if (sel) onChange(sel);
      }}
      options={options.map((o) => ({ value: o.id, label: o.label }))}
    />
  );
}
