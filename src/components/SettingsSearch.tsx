'use client';

import { useRef, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { SearchField, EmptyState } from '@/components/kit';
import { Search } from '@/components/icons';

/**
 * E7: client-side settings search. The input finds the nearest
 * [data-settings-root] ancestor and filters its [data-settings-section]
 * blocks by their data-keywords attribute. Instant, no refetch.
 *
 * Kit migration: design/SearchField took an event onChange; the kit
 * SearchField passes the value, so the wrapper ref locates the
 * [data-settings-root] ancestor instead of the input element.
 */
export default function SettingsSearch({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const applyFilter = (value: string) => {
    setQuery(value);
    const root = wrapRef.current?.closest('[data-settings-root]');
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
    <div ref={wrapRef} className="sticky top-0 z-10 bg-ej-bg/95 py-2">
      <SearchField
        label={t(locale, 't10misc.settingsMain.searchLabel')}
        value={query}
        onChange={applyFilter}
        onClear={() => applyFilter('')}
        placeholder={t(locale, 't10misc.settingsMain.searchPh')}
        clearLabel={t(locale, 'jobs.clearSearch')}
      />
      {visible === 0 && (
        <div className="mt-2">
          <EmptyState
            icon={Search}
            title={t(locale, 't10misc.settingsMain.noResults')}
            text={t(locale, 't10misc.settingsMain.noResultsHint')}
          />
        </div>
      )}
    </div>
  );
}
