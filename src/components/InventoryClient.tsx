'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Minus, Plus, AlertTriangle } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, Badge } from '@/components/ui';
import { adjustPartQuantity } from '@/app/actions/inventory';
import { cn } from '@/lib/utils';

export interface InventoryPart {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  reorderPoint: number | null;
  unitCost: number | null;
  unit: string | null;
  lowStock: boolean;
  outOfStock: boolean;
}

export default function InventoryClient({
  parts: initialParts,
  locale,
  initialQuery,
}: {
  parts: InventoryPart[];
  locale: Locale;
  initialQuery: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const T = (k: string) => t(locale, `inventory.${k}`);

  const [parts, setParts] = useState(initialParts);

  const doSearch = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v.trim()) params.set('q', v.trim());
    else params.delete('q');
    startTransition(() => router.replace(`/inventory?${params.toString()}`));
  };

  const adjust = (part: InventoryPart, delta: number) => {
    const newQty = part.quantity + delta;
    if (newQty < 0) return;
    setParts((prev) =>
      prev.map((p) =>
        p.id === part.id
          ? {
              ...p,
              quantity: newQty,
              lowStock: p.reorderPoint != null && newQty <= p.reorderPoint,
              outOfStock: newQty <= 0,
            }
          : p
      )
    );
    startTransition(async () => {
      const res = await adjustPartQuantity(part.id, delta);
      if (!res.ok) {
        // Roll back
        setParts((prev) => prev.map((p) => (p.id === part.id ? part : p)));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            doSearch(e.target.value);
          }}
          placeholder={T('searchPlaceholder')}
          aria-label={T('searchPlaceholder')}
          className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((part) => (
          <Card key={part.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/inventory/${part.id}`}
                  className="font-semibold text-sm text-zinc-900 hover:text-lime-700 truncate block"
                >
                  {part.name}
                </Link>
                {part.sku && (
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">{part.sku}</p>
                )}
              </div>
              {part.outOfStock ? (
                <Badge tone="danger">{T('outOfStock')}</Badge>
              ) : part.lowStock ? (
                <Badge tone="warning" className="inline-flex items-center gap-1">
                  <AlertTriangle size={11} /> {T('lowStock')}
                </Badge>
              ) : (
                <Badge tone="success">{T('inStock')}</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjust(part, -1)}
                  disabled={pending || part.quantity <= 0}
                  aria-label={`${T('adjust')} -1`}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="text-lg font-bold tabular-nums min-w-[3rem] text-center">
                  {part.quantity}
                  {part.unit && <span className="text-xs font-normal text-zinc-500 ml-1">{part.unit}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => adjust(part, 1)}
                  disabled={pending}
                  aria-label={`${T('adjust')} +1`}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
              {part.unitCost != null && part.unitCost > 0 && (
                <span className="text-xs text-zinc-500 tabular-nums">
                  ${part.unitCost.toFixed(2)}/{part.unit ?? 'ea'}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
