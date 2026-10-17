'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { CreditCard, Unplug, ShieldCheck, ExternalLink, Receipt } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Card, dangerBtnClass, primaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatMoney } from '@/lib/money';
import {
  getStripeDashboard,
  confirmLivePaymentsAction,
  disconnectStripeAction,
} from '@/app/actions/stripe';

type Dashboard = Awaited<ReturnType<typeof getStripeDashboard>>;

function PaymentCards({
  rows,
  locale,
  refLabel,
}: {
  rows: Array<{
    id: string;
    amount: number;
    status: string;
    receiptUrl: string | null;
    createdAt: string;
    customerName: string;
  }>;
  locale: Locale;
  refLabel: (r: Record<string, unknown>) => string;
}) {
  return (
    <ul className="space-y-2.5 md:hidden">
      {rows.map((p) => (
        <li key={p.id} className="rounded-xl border border-line/70 bg-surface p-3.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-ink truncate">{p.customerName}</p>
            <p className="font-bold text-ink shrink-0">{formatMoney(p.amount, 'CAD', locale)}</p>
          </div>
          <p className="text-ink-2 mt-1">
            {new Date(p.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')} · {refLabel(p)} · {p.status}
          </p>
          {p.receiptUrl && (
            <a
              href={p.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 min-h-[44px] text-indigo-600 hover:underline font-semibold py-1"
            >
              <Receipt size={12} /> {t(locale, 'payments.receiptLink')}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function PaymentsSettingsClient({
  initial,
  locale,
  connectFailed,
}: {
  initial: Dashboard;
  locale: Locale;
  connectFailed?: boolean;
}) {
  // B10.4 double-submit protection on the live-payments confirmation.
  const [liveState, liveAction, livePending] = useActionState(confirmLivePaymentsAction, {});
  const [, startDisconnect] = useTransition();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const conn = initial.connection;

  useEffect(() => {
    if (liveState.error) toast.error(liveState.error);
    else if (liveState.ok) toast.success(t(locale, 'payments.liveConfirmed'));
  }, [liveState, locale]);

  function doDisconnect() {
    startDisconnect(async () => {
      try {
        await disconnectStripeAction();
        toast.success(t(locale, 'payments.disconnected'));
        window.location.reload();
      } catch {
        toast.error(t(locale, 't10misc.misc.draftError'));
      }
      setConfirmingDisconnect(false);
    });
  }

  return (
    <div className="space-y-6">
      {connectFailed && (
        <div className="rounded-xl border border-red-200 bg-danger-bg px-4 py-3 text-sm font-semibold text-red-800">
          {t(locale, 'payments.connectFailed')}
        </div>
      )}
      {!initial.stripeConfigured && (
        <div className="rounded-xl border border-amber-200 bg-warn-bg px-4 py-3 text-sm font-semibold text-amber-800">
          {t(locale, 'payments.notConfigured')}
        </div>
      )}

      {/* Stripe Connect */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
          <CreditCard size={15} className="text-indigo-600" />
          {t(locale, 'payments.connectTitle')}
        </h2>
        <p className="text-xs text-ink-2 mb-4">{t(locale, 'payments.connectDesc')}</p>

        {!conn ? (
          <a href="/api/stripe/connect" className={primaryBtnClass}>
            <ExternalLink size={13} /> {t(locale, 'payments.connectButton')}
          </a>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ok bg-ok-bg border border-emerald-200 rounded-full px-3 py-1">
                <ShieldCheck size={13} /> {t(locale, 'payments.connected')}
              </span>
              {conn.livemode ? (
                <span className="text-xs font-bold text-ink bg-surface-2 border border-line rounded-full px-3 py-1">
                  {t(locale, 'payments.liveModeBadge')}
                </span>
              ) : (
                <span className="text-xs font-bold text-warn-text bg-warn-bg border border-amber-200 rounded-full px-3 py-1">
                  {t(locale, 'payments.testModeBadge')}
                </span>
              )}
              <span className="text-xs text-ink-2">
                {t(locale, 'payments.accountId')}: {conn.stripeAccountId}
              </span>
            </div>
            {!conn.livemode && (
              <p className="text-xs text-ink-2">{t(locale, 'payments.testModeDesc')}</p>
            )}
            {!conn.onboardingComplete && (
              <p className="text-xs font-semibold text-warn-text">
                {t(locale, 'payments.onboardingIncomplete')}
              </p>
            )}
            {conn.livemode && !conn.liveConfirmedAt && (
              <form action={liveAction} className="rounded-xl border border-rose-200 bg-danger-bg/60 p-3 space-y-2">
                <p className="text-xs font-bold text-ink">{t(locale, 'payments.liveConfirmTitle')}</p>
                <p className="text-xs text-ink-2">{t(locale, 'payments.liveConfirmDesc')}</p>
                <label className="flex items-start gap-2 text-xs text-ink cursor-pointer">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4 accent-rose-600" />
                  <span className="font-semibold">{t(locale, 'payments.liveConfirmLabel')}</span>
                </label>
                {liveState.error && <p className="text-xs font-semibold text-danger">{liveState.error}</p>}
                {liveState.ok && <p className="text-xs font-semibold text-ok">{t(locale, 'payments.liveConfirmed')}</p>}
                <button type="submit" disabled={livePending} className={primaryBtnClass}>
                  {t(locale, 'payments.liveConfirmButton')}
                </button>
              </form>
            )}
            {conn.livemode && conn.liveConfirmedAt && (
              <p className="text-xs font-semibold text-ok">{t(locale, 'payments.liveConfirmed')}</p>
            )}
            <div>
              <button onClick={() => setConfirmingDisconnect(true)} className={dangerBtnClass}>
                <Unplug size={13} /> {t(locale, 'payments.disconnect')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Recent online payments */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-3">{t(locale, 'payments.recentPayments')}</h2>
        {initial.payments.length === 0 ? (
          <p className="text-xs text-ink-2">{t(locale, 'payments.empty')}</p>
        ) : (
          <>
            <PaymentCards rows={initial.payments} locale={locale} refLabel={(p) => String(p.invoiceNumber ?? '')} />
            <div className="overflow-x-auto hidden md:block mt-0.5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-2 border-b border-line">
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colDate')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colCustomer')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colRef')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colAmount')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colStatus')}</th>
                    <th className="py-1.5 font-semibold">{t(locale, 'payments.colReceipt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {initial.payments.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-50">
                      <td className="py-1.5 pr-2 text-ink-2 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
                      </td>
                      <td className="py-1.5 pr-2">{p.customerName}</td>
                      <td className="py-1.5 pr-2">{p.invoiceNumber}</td>
                      <td className="py-1.5 pr-2 font-semibold">{formatMoney(p.amount, 'CAD', locale)}</td>
                      <td className="py-1.5 pr-2">{p.status}</td>
                      <td className="py-1.5">
                        {p.receiptUrl ? (
                          <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold">
                            <Receipt size={12} /> {t(locale, 'payments.receiptLink')}
                          </a>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Recent online deposits */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-3">{t(locale, 'payments.recentDeposits')}</h2>
        {initial.deposits.length === 0 ? (
          <p className="text-xs text-ink-2">{t(locale, 'payments.empty')}</p>
        ) : (
          <>
            <PaymentCards rows={initial.deposits} locale={locale} refLabel={(d) => String(d.quoteNumber ?? '')} />
            <div className="overflow-x-auto hidden md:block mt-0.5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-2 border-b border-line">
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colDate')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colCustomer')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colRef')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colAmount')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'payments.colStatus')}</th>
                    <th className="py-1.5 font-semibold">{t(locale, 'payments.colReceipt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {initial.deposits.map((d) => (
                    <tr key={d.id} className="border-b border-zinc-50">
                      <td className="py-1.5 pr-2 text-ink-2 whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
                      </td>
                      <td className="py-1.5 pr-2">{d.customerName}</td>
                      <td className="py-1.5 pr-2">{d.quoteNumber}</td>
                      <td className="py-1.5 pr-2 font-semibold">{formatMoney(d.amount, 'CAD', locale)}</td>
                      <td className="py-1.5 pr-2">{d.status}</td>
                      <td className="py-1.5">
                        {d.receiptUrl ? (
                          <a href={d.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold">
                            <Receipt size={12} /> {t(locale, 'payments.receiptLink')}
                          </a>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog
        open={confirmingDisconnect}
        locale={locale}
        title={t(locale, 't10misc.confirm.disconnectStripeTitle')}
        message={t(locale, 't10misc.confirm.disconnectStripeMsg')}
        confirmLabel={t(locale, 't10misc.confirm.yesDisconnect')}
        onConfirm={doDisconnect}
        onClose={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}