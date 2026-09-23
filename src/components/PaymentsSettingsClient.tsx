'use client';

import { useActionState, useTransition } from 'react';
import { CreditCard, Unplug, ShieldCheck, ExternalLink, Receipt } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import {
  getStripeDashboard,
  confirmLivePaymentsAction,
  disconnectStripeAction,
} from '@/app/actions/stripe';

type Dashboard = Awaited<ReturnType<typeof getStripeDashboard>>;

export default function PaymentsSettingsClient({
  initial,
  locale,
}: {
  initial: Dashboard;
  locale: Locale;
}) {
  const [liveState, liveAction] = useActionState(confirmLivePaymentsAction, {});
  const [, startDisconnect] = useTransition();

  const conn = initial.connection;

  function doDisconnect() {
    if (!confirm(t(locale, 'payments.disconnect') + '?')) return;
    startDisconnect(async () => {
      await disconnectStripeAction();
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {!initial.stripeConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t(locale, 'payments.notConfigured')}
        </div>
      )}

      {/* Stripe Connect */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <CreditCard size={15} className="text-indigo-600" />
          {t(locale, 'payments.connectTitle')}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'payments.connectDesc')}</p>

        {!conn ? (
          <a href="/api/stripe/connect" className={primaryBtnClass}>
            <ExternalLink size={13} /> {t(locale, 'payments.connectButton')}
          </a>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                <ShieldCheck size={13} /> {t(locale, 'payments.connected')}
              </span>
              {conn.livemode ? (
                <span className="text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-full px-3 py-1">
                  {t(locale, 'payments.liveModeBadge')}
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  {t(locale, 'payments.testModeBadge')}
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {t(locale, 'payments.accountId')}: {conn.stripeAccountId}
              </span>
            </div>
            {!conn.livemode && (
              <p className="text-xs text-zinc-500">{t(locale, 'payments.testModeDesc')}</p>
            )}
            {!conn.onboardingComplete && (
              <p className="text-xs font-semibold text-amber-700">
                {t(locale, 'payments.onboardingIncomplete')}
              </p>
            )}
            {conn.livemode && !conn.liveConfirmedAt && (
              <form action={liveAction} className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-2">
                <p className="text-xs font-bold text-zinc-800">{t(locale, 'payments.liveConfirmTitle')}</p>
                <p className="text-xs text-zinc-600">{t(locale, 'payments.liveConfirmDesc')}</p>
                <label className="flex items-start gap-2 text-xs text-zinc-800 cursor-pointer">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4 accent-rose-600" />
                  <span className="font-semibold">{t(locale, 'payments.liveConfirmLabel')}</span>
                </label>
                {liveState.error && <p className="text-xs font-semibold text-rose-600">{liveState.error}</p>}
                {liveState.ok && <p className="text-xs font-semibold text-emerald-600">{t(locale, 'payments.liveConfirmed')}</p>}
                <button type="submit" className={primaryBtnClass}>
                  {t(locale, 'payments.liveConfirmButton')}
                </button>
              </form>
            )}
            {conn.livemode && conn.liveConfirmedAt && (
              <p className="text-xs font-semibold text-emerald-700">{t(locale, 'payments.liveConfirmed')}</p>
            )}
            <div>
              <button onClick={doDisconnect} className={secondaryBtnClass}>
                <Unplug size={13} /> {t(locale, 'payments.disconnect')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Recent online payments */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">{t(locale, 'payments.recentPayments')}</h2>
        {initial.payments.length === 0 ? (
          <p className="text-xs text-zinc-500">{t(locale, 'payments.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-100">
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
                    <td className="py-1.5 pr-2 text-zinc-500 whitespace-nowrap">
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
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent online deposits */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">{t(locale, 'payments.recentDeposits')}</h2>
        {initial.deposits.length === 0 ? (
          <p className="text-xs text-zinc-500">{t(locale, 'payments.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-100">
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
                    <td className="py-1.5 pr-2 text-zinc-500 whitespace-nowrap">
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
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
