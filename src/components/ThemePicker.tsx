"use client";

import { useState } from 'react';
import { Sun, Moon, Monitor } from '@/components/icons';
import { cn } from '@/lib/utils';

/** localStorage key shared with the pre-paint theme script in app/layout.tsx. */
export const THEME_KEY = 'ej-theme';
export type ThemeChoice = 'light' | 'dark' | 'system';

export function getSavedTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode - theme just won't persist */
  }
}

/**
 * Appearance picker (Part B): Light / Dark / System. Persists to
 * localStorage and toggles .dark on <html> immediately. The inline script
 * in app/layout.tsx applies the saved choice before first paint.
 */
export default function ThemePicker({
  labels,
}: {
  labels: { light: string; dark: string; system: string };
}) {
  // Lazy initializer reads localStorage (guarded try/catch inside, so SSR
  // safely falls back to 'system'); no setState-in-effect needed.
  const [choice, setChoice] = useState<ThemeChoice>(getSavedTheme);

  const pick = (c: ThemeChoice) => {
    setChoice(c);
    applyTheme(c);
  };

  const options: { id: ThemeChoice; label: string; Icon: typeof Sun }[] = [
    { id: 'light', label: labels.light, Icon: Sun },
    { id: 'dark', label: labels.dark, Icon: Moon },
    { id: 'system', label: labels.system, Icon: Monitor },
  ];

  return (
    <div role="radiogroup" aria-label="appearance" className="grid grid-cols-3 gap-2">
      {options.map(({ id, label, Icon }) => {
        const active = choice === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(id)}
            className={cn(
              'flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors',
              active
                ? 'border-asphalt bg-asphalt text-white dark:border-hivis dark:bg-hivis dark:text-asphalt'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-coal dark:text-zinc-300 dark:hover:bg-white/5'
            )}
          >
            <Icon size={18} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
