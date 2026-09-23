'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Search, Phone } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { Card, EmptyState, primaryBtnClass } from '@/components/ui';

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
 * the list client-side across name, phone, email and address — no submit or
 * page reload needed.
 */
export default function CustomersClient({
  customers,
  currency,
}: {
  customers: CustomerRow[];
  currency?: string;
}) {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or address…"
          aria-label="Search customers"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink"
        />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`text-[11px] font-bold rounded-full px-3 py-1.5 transition-colors ${
              activeTag === null
                ? 'bg-ink text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-[11px] font-bold rounded-full px-3 py-1.5 transition-colors ${
                activeTag === tag
                  ? 'bg-ink text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={24} />}
            title={query.trim() || activeTag ? 'No customers found' : 'No customers yet'}
            description={
              query.trim() || activeTag
                ? `No customers match${activeTag ? ` tag "${activeTag}"` : ''}${query.trim() ? ` and "${query.trim()}"` : ''}. Try a different search, or add a new customer.`
                : 'Add your first customer to start creating jobs and invoices for them.'
            }
            action={
              <Link href="/customers/new" className={primaryBtnClass}>
                <Plus size={14} /> Add customer
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <p className="text-xs font-semibold text-zinc-500">
            {filtered.length} customer{filtered.length === 1 ? '' : 's'}
            {activeTag ? ` tagged "${activeTag}"` : ''}
            {query.trim() ? ` matching "${query.trim()}"` : ''}
            {(activeTag || query.trim()) && (
              <button
                type="button"
                onClick={() => { setActiveTag(null); setQuery(''); }}
                className="ml-2 text-ink font-bold hover:underline"
              >
                Clear filters
              </button>
            )}
          </p>
          <Card>
            <ul className="divide-y divide-zinc-100">
              {filtered.map((c) => {
                const initial = (c.name || '?').charAt(0).toUpperCase();
                return (
                  <li key={c.id}>
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-ink/10 text-ink flex items-center justify-center font-bold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-zinc-900 truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                          {c.phone ? (
                            <>
                              <Phone size={11} /> {c.phone}
                            </>
                          ) : (
                            'No phone'
                          )}
                        </p>
                        {(c.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(c.tags ?? []).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-zinc-900">{formatMoney(c.revenue, currency)}</p>
                        <p className="text-[11px] text-zinc-500">
                          {c.jobCount} job{c.jobCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
