'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Search, Phone, Upload } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import MoneyText from '@/components/MoneyText';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  StatusBadge,
} from '@/components/kit';
import ExportButtons, { type ExportColumn, type ExportRow } from '@/components/ExportButtons';

/** Replace `{name}` tokens in a template string (minimal inline fill helper). */
function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tags: string[];
  jobCount: number;
  revenue: number;
};

/**
 * Customer list with a live search box and tag filter chips. Typing filters
 * the list client-side across name, phone, email and address - no submit or
 * page reload needed.
 */
export default function CustomersClient({
  customers,
  currency,
  locale = 'en',
}: {
  customers: CustomerRow[];
  currency?: string;
  locale?: Locale;
}) {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const router = useRouter();
  const L = (path: string) => t(locale, `t10money.${path}`);

  // Distinct tags across this business's customers (tenant-safe: only this
  // business's customers are in `customers`), for the filter chips.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      for (const t of c.tags ?? []) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (activeTag && !(c.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      return (
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, query, activeTag]);

  const hasFilter = query.trim() !== '' || activeTag !== null;
  const countLabel = fill(
    L(filtered.length === 1 ? 'custListCountOne' : 'custListCountMany'),
    { count: filtered.length }
  );

  // Export the *currently filtered* list (2026-09-24).
  const exportColumns: ExportColumn[] = useMemo(
    () => [
      { key: 'name', label: t(locale, 'exports.colName') },
      { key: 'phone', label: t(locale, 'exports.colPhone') },
      { key: 'email', label: t(locale, 'exports.colEmail') },
      { key: 'address', label: t(locale, 'exports.colAddress') },
      { key: 'tags', label: t(locale, 'exports.colTags') },
      { key: 'jobs', label: t(locale, 'exports.colJobs') },
      { key: 'revenue', label: t(locale, 'exports.colRevenue'), kind: 'money' },
    ],
    [locale]
  );
  const exportRows: ExportRow[] = useMemo(
    () =>
      filtered.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tags: (c.tags ?? []).join(', '),
        jobs: c.jobCount,
        revenue: c.revenue,
      })),
    [filtered]
  );
  const exportFileBase = useMemo(
    () => `everyjob-customers-${new Date().toISOString().slice(0, 10)}`,
    []
  );

  const chipClass = (active: boolean) =>
    `min-h-[44px] inline-flex items-center text-xs font-bold rounded-full px-4 transition-colors ${
      active ? 'bg-asphalt text-hero-ink' : 'bg-surface text-ink-2 border border-line hover:border-line-strong'
    }`;

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, 'customers.searchPlaceholder')}
          aria-label={t(locale, 'customers.searchPlaceholder')}
          className="input !pl-11 !rounded-full !bg-surface shadow-sm"
        />
      </div>

      {/* Export the currently filtered list + jump to the importer */}
      <div className="flex flex-wrap items-center gap-2">
        <ExportButtons
          columns={exportColumns}
          rows={exportRows}
          fileBase={exportFileBase}
          currency={currency}
          locale={locale}
        />
        <Button href="/imports?type=customers" variant="secondary">
          <Upload size={14} /> {t(locale, 'exports.importBtn')}
        </Button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={L('custListFilterTags')}>
          <button type="button" onClick={() => setActiveTag(null)} className={chipClass(activeTag === null)}>
            {L('custListAll')}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
              className={chipClass(activeTag === tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={hasFilter ? t(locale, 'customers.noResults') : L('custListNoCustomersYet')}
            text={
              hasFilter
                ? `${countLabel}${activeTag ? ` ${fill(L('custListTagged'), { tag: activeTag })}` : ''}${query.trim() ? ` ${fill(L('custListMatching'), { q: query.trim() })}` : ''}.`
                : L('custListNoCustomersDesc')
            }
            actionLabel={L('custListAddCustomer')}
            onAction={() => router.push('/customers/new')}
          />
        </Card>
      ) : (
        <>
          <p className="text-xs font-semibold text-ink-2">
            {countLabel}
            {activeTag ? ` ${fill(L('custListTagged'), { tag: activeTag })}` : ''}
            {query.trim() ? ` ${fill(L('custListMatching'), { q: query.trim() })}` : ''}
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setActiveTag(null);
                  setQuery('');
                }}
                className="ml-2 min-h-[44px] inline-flex items-center text-ink font-bold hover:underline"
              >
                {L('custListClear')}
              </button>
            )}
          </p>
          <Card className="!p-0 overflow-hidden">
            <ul className="divide-y divide-line">
              {filtered.map((c, i) => (
                <li
                  key={c.id}
                  className="ej-row-in"
                  style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as React.CSSProperties}
                >
                  <Link
                    href={`/customers/${c.id}`}
                    className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-surface-2 active:bg-surface-2 transition-colors min-h-[72px]"
                  >
                    <Avatar
                      initials={c.name
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-ink truncate">{c.name}</p>
                      {c.phone ? (
                        <p className="text-xs text-ink-2 truncate flex items-center gap-1 mt-0.5">
                          <Phone size={11} aria-hidden /> {c.phone}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-2 mt-0.5">{L('custListNoPhone')}</p>
                      )}
                      {(c.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(c.tags ?? []).map((tag) => (
                            <StatusBadge key={tag} tone="neutral">
                              {tag}
                            </StatusBadge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-ink tabular-nums">
                        <MoneyText dollars={c.revenue} locale={locale} />
                      </p>
                      <p className="text-[11px] text-ink-2">
                        {fill(L(c.jobCount === 1 ? 'custListJobOne' : 'custListJobMany'), {
                          count: c.jobCount,
                        })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
