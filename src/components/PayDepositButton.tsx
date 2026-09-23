'use client';

import { useState, useTransition } from 'react';
import { CreditCard } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

/**
 * Public "Pay deposit" button on the quote portal. Creates a Stripe Checkout
 * Session (via /api/pay/quote-deposit) and redirects to Stripe's hosted
 * page — card data never touches our servers.
 */
export default function PayDepositButton({
  token,
  amount,
  testMode,
  locale,
}: {
  token: string;
  amount: number;
  testMode: boolean;
  locale: Locale;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/pay/quote-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error ?? t(locale, 'payments.payError'));
        }
      } catch {
        setError(t(locale, 'payments.payError'));
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={start}
        disabled={pending}
        className="min-h-[52px] flex items-center justify-center gap-2 w-full bg-ink hover:bg-graphite disabled:opacity-60 text-white font-bold text-sm py-3 rounded-2xl transition-colors"
      >
        <CreditCard size={16} />
        {pending
          ? t(locale, 'payments.payStarting')
          : `${t(locale, 'payments.payDeposit')} · ${formatMoney(amount, 'CAD', locale)}`}
      </button>
      {testMode && (
        <p className="text-[11px] text-amber-700 font-semibold text-center">
          {t(locale, 'payments.payTestNote')}
        </p>
      )}
      {error && <p className="text-xs font-semibold text-rose-600 text-center">{error}</p>}
    </div>
  );
}
