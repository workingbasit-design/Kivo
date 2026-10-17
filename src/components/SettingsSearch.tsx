'use client';

import { useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { SearchField } from '@/components/design/navigation';
import { EmptyState } from '@/components/design/feedback';

/**
 * E7: client-side settings search. The input finds the nearest
 * [data-settings-root] ancestor and filters its [data-settings-section]
 * blocks by their data-keywords attribute. Instant, no refetch.
 */
export default function SettingsSearch({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<number | null>(null);

  const applyFilter = (value: string, input: HTMLInputElement) => {
    setQuery(value);
    const root = input.closest('[data-settings-root]');
    if (!root) return;
    const needle = value.trim().toLowerCase();
    const sections = root.querySelectorAll<HTMLElement>('[data-settings-section]');
    let count = 0;
    sections.forEach((s) => {
      const kw = (s.getAttribute('data-keywords') || '').toLowerCase();
      const match = !needle || kw.includes(needle);
      s.style.display = match ? '' : 'none';
      if (match) count++;
    });
    const nav = root.querySelector<HTMLElement>('[data-settings-nav]');
    if (nav) nav.style.display = needle ? 'none' : '';
    setVisible(needle ? count : null);
  };

  return (
    <div className="sticky top-0 z-10 bg-ej-bg/95 py-2">
      <SearchField
        id="settings-search"
        label={t(locale, 't10misc.settingsMain.searchLabel')}
        value={query}
        onChange={(e) => applyFilter(e.target.value, e.target)}
        onClear={() => {
          const input = document.getElementById('settings-search') as HTMLInputElement | null;
          if (input) applyFilter('', input);
        }}
        placeholder={t(locale, 't10misc.settingsMain.searchPh')}
      />
      {visible === 0 && (
        <div className="mt-2">
          <EmptyState
            title={t(locale, 't10misc.settingsMain.noResults')}
            description={t(locale, 't10misc.settingsMain.noResultsHint')}
          />
        </div>
      )}
    </div>
  );
}
