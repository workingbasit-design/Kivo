'use client';

import { inputClass } from '@/components/ui';
import type { Locale } from '@/lib/i18n';

/**
 * Locale-aware time picker.
 *
 * Why not <input type="time">? On iOS Safari the native time input renders
 * in the DEVICE's locale, not the app's locale — a French user with their
 * phone set to English (US) sees "9:00 AM" in an otherwise French UI.
 * These two selects render per the APP locale: French shows 24h ("9 h"),
 * English shows 12h ("9 AM"). The value stays "HH:MM" (24h) or '' (no
 * time), so stored data never changes shape.
 */
export function TimeField({
  value,
  onChange,
  locale,
  disabled,
  ariaLabel,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  locale: Locale;
  disabled?: boolean;
  ariaLabel?: string;
  /** When set (plain HTML form submission), renders a hidden input carrying the "HH:MM" value. */
  name?: string;
}) {
  const parts = (value || '').split(':');
  const hour: number | '' =
    parts[0] === '' || parts[0] == null ? '' : Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
  const minute: number | '' =
    parts[1] === '' || parts[1] == null ? '' : Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));

  const setHour = (h: number | '') => {
    if (h === '') {
      onChange('');
      return;
    }
    onChange(`${String(h).padStart(2, '0')}:${String(minute === '' ? 0 : minute).padStart(2, '0')}`);
  };
  const setMinute = (m: number | '') => {
    if (m === '') {
      onChange(hour === '' ? '' : `${String(hour).padStart(2, '0')}:00`);
      return;
    }
    onChange(`${String(hour === '' ? 9 : hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const hourLabel = (h: number) => {
    if (locale === 'fr') return `${h} h`;
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  return (
    <span className="flex items-center gap-2">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <select
        value={hour}
        onChange={(e) => setHour(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        aria-label={ariaLabel ?? (locale === 'fr' ? 'Heure' : 'Hour')}
        className={inputClass}
      >
        <option value="">—</option>
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-ink-2 font-bold">
        :
      </span>
      <select
        value={minute}
        onChange={(e) => setMinute(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        aria-label={ariaLabel ?? (locale === 'fr' ? 'Minute' : 'Minute')}
        className={inputClass}
      >
        <option value="">—</option>
        {Array.from({ length: 60 }, (_, m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
    </span>
  );
}
