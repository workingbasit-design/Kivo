"use client";

import { useState } from 'react';

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
 *
 * ChatGPT Settings redesign: three swatch buttons (prototype
 * `.appearance-options`) - a light swatch, a half-light/half-dark system
 * swatch, and a dark swatch. The selected option uses the kit selected
 * treatment (hivis bg + hivis-ink text), identical in light and dark
 * mode. Swatches are built from non-flipping tokens (--hero-ink,
 * --asphalt) so the preview reads correctly under either theme.
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

  const options: { id: ThemeChoice; label: string; swatch: string }[] = [
    { id: 'light', label: labels.light, swatch: 'ej-settings-swatch' },
    { id: 'system', label: labels.system, swatch: 'ej-settings-swatch ej-settings-swatch-system' },
    { id: 'dark', label: labels.dark, swatch: 'ej-settings-swatch ej-settings-swatch-dark' },
  ];

  return (
    <div role="radiogroup" aria-label="appearance" className="ej-settings-appearance">
      {options.map(({ id, label, swatch }) => {
        const active = choice === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(id)}
          >
            <span className={swatch} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
