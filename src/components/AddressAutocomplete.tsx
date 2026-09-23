'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

export interface PlaceSuggestion {
  displayName: string;
  lat: string;
  lon: string;
  type: string;
}

interface AddressAutocompleteProps {
  /** Form field name — rendered as a hidden input so forms keep working. */
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (suggestion: PlaceSuggestion) => void;
  placeholder?: string;
  className?: string;
  /** When set, renders a textarea instead of an input (multiline addresses). */
  rows?: number;
  maxLength?: number;
  autoComplete?: string;
  disabled?: boolean;
}

/**
 * Real address autocomplete backed by the free OpenStreetMap Nominatim API
 * via our /api/places/search proxy (no API key needed).
 *
 * Controlled when `value` is provided, uncontrolled with `defaultValue` otherwise.
 * Manual typing always works — suggestions are optional and never submitted.
 */
export default function AddressAutocomplete({
  name,
  defaultValue = '',
  value: valueProp,
  onChange,
  onSelect,
  placeholder,
  className,
  rows,
  maxLength,
  autoComplete = 'off',
  disabled,
}: AddressAutocompleteProps) {
  const controlled = valueProp !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue);
  const value = controlled ? (valueProp as string) : innerValue;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const requestId = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInnerValue(v);
      onChange?.(v);
    },
    [controlled, onChange]
  );

  // Debounced fetch as the user types (min 3 chars).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        if (id !== requestId.current) return;
        if (res.ok) {
          const data = (await res.json()) as { suggestions?: PlaceSuggestion[] };
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 5) : []);
        } else {
          setSuggestions([]);
        }
      } catch {
        if (id === requestId.current) setSuggestions([]);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setActiveIndex(-1);
          setOpen(true);
        }
      }
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [value]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = useCallback(
    (s: PlaceSuggestion) => {
      setValue(s.displayName);
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(s);
    },
    [setValue, onSelect]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && open && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && open && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const showDropdown = open && (loading || suggestions.length > 0);

  const sharedProps = {
    value,
    placeholder,
    maxLength,
    disabled,
    autoComplete,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value);
      setOpen(true);
    },
    onKeyDown,
    onFocus: () => {
      if (value.trim().length >= 3) setOpen(true);
    },
    onBlur: () => {
      // Delay so a click on a suggestion (mousedown) lands first.
      setTimeout(() => setOpen(false), 150);
    },
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* The real form field — the visible input never carries the name. */}
      <input type="hidden" name={name} value={value} />
      {rows ? (
        <textarea rows={rows} className={className} {...sharedProps} />
      ) : (
        <input type="text" className={className} {...sharedProps} />
      )}

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 py-1"
        >
          {loading && (
            <li className="flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-500">
              <Loader2 size={14} className="animate-spin" />
              Looking up addresses…
            </li>
          )}
          {!loading &&
            suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lon}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 cursor-pointer ${
                    i === activeIndex ? 'bg-smoke' : 'hover:bg-zinc-50'
                  }`}
                >
                  <MapPin size={14} className="text-ink mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug text-zinc-900 truncate">
                      {s.displayName}
                    </span>
                    {s.type && (
                      <span className="block text-[11px] text-zinc-400 capitalize">{s.type}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
