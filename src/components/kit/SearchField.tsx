'use client';

import { Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the clear button is tapped; defaults to onChange(''). */
  onClear?: () => void;
  /** Placeholder text (a prop — no hard-coded copy). */
  placeholder: string;
  /** Accessible name for the input. */
  label: string;
  /** Accessible name for the clear button. */
  clearLabel: string;
}

/**
 * Search box: magnifier icon, text input, and a clear button that appears
 * while there is a query. The container glows with the focus ring.
 */
export function SearchField({
  value,
  onChange,
  onClear,
  placeholder,
  label,
  clearLabel,
}: SearchFieldProps) {
  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };
  return (
    <div
      data-kit="search-field"
      className={cn(
        'mb-3 flex min-h-[50px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5',
        'focus-within:ring-[3px] focus-within:ring-focus'
      )}
    >
      <Search size={22} aria-hidden className="flex-none text-ink-2" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-2"
      />
      {value !== '' && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearLabel}
          className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink-2 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}

export default SearchField;
