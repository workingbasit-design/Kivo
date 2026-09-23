'use client';

import { useActionState, useState } from 'react';
import { Pencil } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, secondaryBtnClass, primaryBtnClass } from '@/components/ui';
import LineItemsEditor from '@/components/LineItemsEditor';
import { updateQuoteItems, type ActionResult } from '@/app/actions/quotes';

/**
 * Draft-only line-item editor on the quote detail page. Posts the new items
 * (and discount) to updateQuoteItems; the server recomputes the total.
 */
export default function QuoteItemsEditor({
  quoteId,
  locale,
  initial,
}: {
  quoteId: string;
  locale: Locale;
  initial: {
    items: { desc: string; qty: string; rate: string }[];
    discountType: 'PERCENT' | 'AMOUNT' | null;
    discountValue: number | null;
  };
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    updateQuoteItems,
    {}
  );
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-6">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={secondaryBtnClass}>
          <Pencil size={13} /> {t(locale, 'quoteItems.editItems')}
        </button>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={quoteId} />
          <h2 className="text-sm font-bold text-zinc-900">{t(locale, 'quoteItems.editItems')}</h2>
          <LineItemsEditor
            initialItems={initial.items}
            initialDiscount={{
              type: initial.discountType,
              value: initial.discountValue != null ? String(initial.discountValue) : '',
            }}
          />
          {state?.error && (
            <p className="text-xs font-semibold text-rose-600">{state.error}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className={primaryBtnClass}>
              {isPending ? t(locale, 'quoteItems.saving') : t(locale, 'quoteItems.saveItems')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={secondaryBtnClass}
            >
              {t(locale, 'quoteItems.cancel')}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
