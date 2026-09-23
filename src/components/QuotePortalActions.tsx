'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { portalQuoteDecisionByToken } from '@/app/actions/quotes';
import { formatMoney } from '@/lib/money';
import { addonQuoteTotal } from '@/lib/quotes';

export interface PortalAddon {
  id: string;
  title: string;
  price: number;
  selected: boolean;
}

export interface QuotePortalStrings {
  addonsTitle: string;
  addonsHint: string;
  baseTotal: string;
  yourTotal: string;
  waitLabel: string;
  approveLabel: string;
  declineLabel: string;
  responseNote: string;
  errorLabel: string;
  /** Locale for money formatting, e.g. 'en' or 'fr'. Defaults to 'en'. */
  locale?: string;
}

/**
 * Public quote decision UI (approve / decline) with optional client-togglable
 * add-ons. Checkboxes update the displayed total live; on approve the
 * selected add-on ids are sent to the server action, which persists them.
 */
export default function QuotePortalActions({
  token,
  addons = [],
  baseTotal = 0,
  currency = 'CAD',
  strings,
}: {
  token: string;
  addons?: PortalAddon[];
  baseTotal?: number;
  currency?: string;
  strings: QuotePortalStrings;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const moneyLocale = strings.locale === 'fr' ? 'fr' : 'en';
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    addons.filter((a) => a.selected).map((a) => a.id)
  );
  const router = useRouter();

  const hasAddons = addons.length > 0;
  const liveTotal = hasAddons
    ? addonQuoteTotal(
        baseTotal,
        addons.map((a) => ({ price: a.price, selected: selectedIds.includes(a.id) }))
      )
    : baseTotal;

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  function decide(decision: 'APPROVED' | 'DECLINED') {
    setMessage(null);
    startTransition(async () => {
      const res = await portalQuoteDecisionByToken(
        token,
        decision,
        decision === 'APPROVED' ? selectedIds : []
      );
      if (res.ok) {
        router.refresh();
      } else {
        setMessage(res.error ?? strings.errorLabel);
        if (res.status) router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {message}
        </p>
      )}

      {hasAddons && (
        <fieldset>
          <legend className="text-sm font-bold text-ink">{strings.addonsTitle}</legend>
          <p className="text-xs text-graphite mt-0.5 mb-3">{strings.addonsHint}</p>
          <ul className="space-y-2">
            {addons.map((a) => {
              const checked = selectedIds.includes(a.id);
              return (
                <li key={a.id}>
                  <label
                    className={`flex items-center justify-between gap-3 border rounded-xl px-3.5 py-3 cursor-pointer transition-colors ${
                      checked
                        ? 'border-ink bg-ink/5'
                        : 'border-smoke hover:border-graphite/50'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(a.id)}
                        disabled={pending}
                        className="w-4 h-4 accent-ink shrink-0"
                      />
                      <span className="text-sm font-semibold text-zinc-900 truncate">
                        {a.title}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-zinc-900 shrink-0">
                      +{formatMoney(a.price, currency, moneyLocale)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {hasAddons && (
        <div className="space-y-1.5 border-t border-smoke pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-graphite">{strings.baseTotal}</span>
            <span className="font-semibold text-ink">
              {formatMoney(baseTotal, currency, moneyLocale)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">{strings.yourTotal}</span>
            <span className="text-xl font-bold text-ink tracking-tight">
              {formatMoney(liveTotal, currency, moneyLocale)}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('APPROVED')}
          className="bg-ink hover:bg-ink/90 text-white justify-center px-4 py-3 rounded-xl font-semibold text-sm transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-60"
        >
          <Check size={16} /> {pending ? strings.waitLabel : strings.approveLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('DECLINED')}
          className="bg-white hover:bg-paper text-graphite justify-center px-4 py-3 rounded-xl font-semibold text-sm transition-colors inline-flex items-center gap-2 border border-smoke shadow-sm disabled:opacity-60"
        >
          <X size={16} /> {strings.declineLabel}
        </button>
      </div>
      <p className="text-[11px] text-graphite text-center">
        {strings.responseNote}
      </p>
    </div>
  );
}
