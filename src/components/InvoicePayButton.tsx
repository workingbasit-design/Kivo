'use client';

import { useState, useTransition } from 'react';
import { CreditCard, Link2, PlugZap } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import CopyButton from '@/components/CopyButton';

/**
 * Owner-side "Collect payment" on the invoice detail view. Creates a Stripe
 * Checkout payment link (via /api/stripe/invoice-checkout) that the owner
 * sends to the customer by text/email. The customer pays on Stripe's hosted
 * page — money settles straight to the business's connected account.
 *
 * When Stripe isn't connected the button is replaced by a graceful hint
 * pointing at Settings → Payments — never a crash, never a dead button.
 */
export default function InvoicePayButton({
  invoiceId,
  balance,
  currency = 'CAD',
  stripeConnected,
  paymentsHref = '/settings/payments',
  locale,
}: {
  invoiceId: string;
  /** Remaining amount due, in dollars. */
  balance: number;
  currency?: string;
  stripeConnected: boolean;
  paymentsHref?: string;
  locale: Locale;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (balance <= 0) return null;

  if (!stripeConnected) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <PlugZap size={16} className="text-zinc-500" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900">
              {t(locale, 'invoicePay.notConnectedTitle')}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {t(locale, 'invoicePay.notConnectedDesc')}
            </p>
            <a href={paymentsHref} className={`${secondaryBtnClass} mt-3`}>
              {t(locale, 'invoicePay.goToPayments')}
            </a>
          </div>
        </div>
      </Card>
    );
  }

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/invoice-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId }),
        });
        const data = (await res.json()) as {
          url?: string;
          testMode?: boolean;
          error?: string;
        };
        if (data.url) {
          setUrl(data.url);
          setTestMode(data.testMode === true);
        } else {
          setError(data.error ?? t(locale, 'invoicePay.createError'));
        }
      } catch {
        setError(t(locale, 'invoicePay.createError'));
      }
    });
  }

  if (url) {
    return (
      <Card className="p-5">
        <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <Link2 size={15} className="text-emerald-600" />
          {t(locale, 'invoicePay.linkReady')}
        </p>
        <p className="text-xs text-zinc-500 mt-1 mb-3">
          {t(locale, 'invoicePay.linkHint')}
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 truncate text-zinc-700 font-mono">
            {url}
          </code>
          <CopyButton text={url} label={t(locale, 'invoicePay.copyLink')} />
        </div>
        {testMode && (
          <p className="text-[11px] text-amber-700 font-semibold mt-2">
            {t(locale, 'invoicePay.testNote')}
          </p>
        )}
        <p className="text-[11px] text-zinc-400 mt-2">
          {t(locale, 'invoicePay.feeNote')}
        </p>
        <button
          type="button"
          onClick={() => {
            setUrl(null);
            setError(null);
          }}
          className={`${secondaryBtnClass} mt-3`}
        >
          {t(locale, 'invoicePay.newLink')}
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-xs text-zinc-500 mb-3">{t(locale, 'invoicePay.collectDesc')}</p>
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className={`${primaryBtnClass} w-full min-h-[52px] text-sm`}
      >
        <CreditCard size={16} />
        {pending
          ? t(locale, 'invoicePay.creating')
          : `${t(locale, 'invoicePay.collectPayment')} · ${formatMoney(balance, currency, locale)}`}
      </button>
      <p className="text-[11px] text-zinc-400 mt-2 text-center">
        {t(locale, 'invoicePay.feeNote')}
      </p>
      {error && (
        <p className="text-xs font-semibold text-rose-600 text-center mt-2">{error}</p>
      )}
    </Card>
  );
}
