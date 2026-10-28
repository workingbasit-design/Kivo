'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, Save } from '@/components/icons';
import { updateQuoteExpiry, type ActionResult } from '@/app/actions/quotes';
import { Button, Card, DateField } from '@/components/kit';
import { t, type Locale } from '@/lib/i18n';

/**
 * Slice 5: validity editor for DRAFT/SENT quotes. The date is CONTROLLED
 * so a failed save (useActionState resets the form element) never wipes
 * it. Blank + save clears the expiry (no expiry).
 */
export default function QuoteExpiryEditor({
  quoteId,
  initialDateKey,
  locale = 'en',
}: {
  quoteId: string;
  /** YYYY-MM-DD in business tz, or '' for no expiry. */
  initialDateKey: string;
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    updateQuoteExpiry,
    {}
  );
  const [date, setDate] = useState(initialDateKey);

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={quoteId} />
        <DateField
          label={t(locale, 'quotes.expiry.validUntil')}
          name="validUntil"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          hint={t(locale, 'quotes.expiry.validUntilHint')}
        />
        {state?.error && (
          <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {state?.ok && (
          <p className="text-xs font-semibold text-ok">
            {t(locale, 'quotes.expiry.expirySaved')}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={isPending}>
          <Save size={14} />
          {t(locale, 'quotes.expiry.saveExpiry')}
        </Button>
      </form>
    </Card>
  );
}
