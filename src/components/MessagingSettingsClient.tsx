'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  MessageCircle,
  Mail,
  Play,
  Eye,
  EyeOff,
  Unplug,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Card, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  getMessagingDashboard,
  saveMessagingSettingsAction,
  connectWhatsAppAction,
  connectEmailAction,
  disconnectChannelAction,
  previewMessagingAction,
  runMessagingNowAction,
} from '@/app/actions/messaging';

type Dashboard = Awaited<ReturnType<typeof getMessagingDashboard>>;

const TOGGLES = [
  'reminder24h',
  'reminderDayOf',
  'invoiceDue',
  'invoiceOverdue',
  'quoteFollowup',
  'reviewRequest',
] as const;

function QuotaBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const exhausted = used >= limit;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-zinc-700">{label}</span>
        <span className={exhausted ? 'font-bold text-rose-600' : 'text-zinc-500'}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${exhausted ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MessagingSettingsClient({
  initial,
  locale,
}: {
  initial: Dashboard;
  locale: Locale;
}) {
  const [dash, setDash] = useState(initial);
  const [waState, waAction] = useActionState(connectWhatsAppAction, {});
  const [emState, emAction] = useActionState(connectEmailAction, {});
  const [saveState, saveAction] = useActionState(saveMessagingSettingsAction, {});
  const [running, startRun] = useTransition();
  const [report, setReport] = useState<Awaited<ReturnType<typeof previewMessagingAction>>['report'] | null>(null);
  const [reportKind, setReportKind] = useState<'preview' | 'run' | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [confirming, setConfirming] = useState<
    null | { kind: 'disconnect'; channel: 'WHATSAPP' | 'EMAIL' } | { kind: 'run' }
  >(null);

  const s = dash.settings;

  useEffect(() => {
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) toast.success(t(locale, 'messaging.settingsSaved'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState.ok, saveState.error]);
  useEffect(() => {
    if (waState.error) toast.error(waState.error);
    else if ((waState as { ok?: boolean }).ok) {
      toast.success(t(locale, 'messaging.connectSaved'));
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waState]);
  useEffect(() => {
    if (emState.error) toast.error(emState.error);
    else if ((emState as { ok?: boolean }).ok) {
      toast.success(t(locale, 'messaging.connectSaved'));
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emState]);

  async function refresh() {
    setDash(await getMessagingDashboard());
  }

  async function doDisconnect(channel: 'WHATSAPP' | 'EMAIL') {
    try {
      await disconnectChannelAction(channel);
      toast.success(t(locale, 'messaging.disconnected'));
    } catch {
      toast.error(t(locale, 't10misc.misc.draftError'));
    }
    setConfirming(null);
    await refresh();
  }

  function doPreview() {
    startRun(async () => {
      const res = await previewMessagingAction();
      if (res.ok) {
        setReport(res.report ?? null);
        setReportKind('preview');
        await refresh();
      }
    });
  }

  function doRun() {
    if (!s.dryRun) {
      setConfirming({ kind: 'run' });
      return;
    }
    executeRun();
  }

  function executeRun() {
    startRun(async () => {
      const res = await runMessagingNowAction();
      if (res.ok) {
        setReport(res.report ?? null);
        setReportKind('run');
        await refresh();
      }
      setConfirming(null);
    });
  }

  const statusLabel = (status: string) => {
    const key = `messaging.st_${status}` as Parameters<typeof t>[1];
    try {
      const v = t(locale, key);
      return v === key ? status : v;
    } catch {
      return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode banner */}
      <div
        className={`rounded-xl border px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
          s.dryRun
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
      >
        {s.dryRun ? <Eye size={16} /> : <Play size={16} />}
        {s.dryRun ? t(locale, 'messaging.previewBadge') : t(locale, 'messaging.liveBadge')}
      </div>

      {/* WhatsApp connection */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <MessageCircle size={15} className="text-emerald-600" />
          {t(locale, 'messaging.whatsappTitle')}
        </h2>
        <p className="text-xs text-zinc-500 mb-2">{t(locale, 'messaging.whatsappDesc')}</p>
        <p className="text-xs text-zinc-500 mb-4 rounded-lg bg-zinc-50 border border-zinc-200/60 px-3 py-2">
          {t(locale, 'messaging.whatsappFreeNote')}
        </p>
        {dash.whatsapp.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <ShieldCheck size={13} /> {t(locale, 'messaging.connected')}
              {dash.whatsapp.displayNumber ? ` · ${dash.whatsapp.displayNumber}` : ''}
            </span>
            {dash.whatsapp.tokenMasked && (
              <span className="text-xs text-zinc-500">Token {dash.whatsapp.tokenMasked}</span>
            )}
            <button onClick={() => setConfirming({ kind: 'disconnect', channel: 'WHATSAPP' })} className={secondaryBtnClass}>
              <Unplug size={13} /> {t(locale, 'messaging.disconnect')}
            </button>
          </div>
        ) : (
          <form action={waAction} className="space-y-3 max-w-lg">
            <p className="text-xs text-zinc-500">{t(locale, 'messaging.whatsappSetupHint')}</p>
            <Field label={t(locale, 'messaging.phoneNumberId')}>
              <input name="phoneNumberId" required className={inputClass} placeholder="123456789012345" />
            </Field>
            <Field label={t(locale, 'messaging.accessToken')}>
              <div className="relative">
                <input
                  name="accessToken"
                  required
                  type={showToken ? 'text' : 'password'}
                  className={`${inputClass} pr-12`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? t(locale, 't10misc.settings.hideValue') : t(locale, 't10misc.settings.showValue')}
                  aria-pressed={showToken}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
                >
                  {showToken ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t(locale, 'messaging.displayNumber')}>
                <input name="displayNumber" className={inputClass} placeholder="+1 416-555-0123" />
              </Field>
              <Field label={t(locale, 'messaging.businessAccountId')}>
                <input name="businessAccountId" className={inputClass} />
              </Field>
            </div>
            {waState.error && <p className="text-xs font-semibold text-rose-600">{waState.error}</p>}
            <button type="submit" className={primaryBtnClass}>
              {t(locale, 'messaging.connect')} WhatsApp
            </button>
            <p className="text-[11px] text-zinc-400">{t(locale, 'messaging.tokenSaved')}</p>
          </form>
        )}
      </Card>

      {/* Email connection */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Mail size={15} className="text-sky-600" />
          {t(locale, 'messaging.emailTitle')}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.emailDesc')}</p>
        {dash.email.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <ShieldCheck size={13} /> {t(locale, 'messaging.connected')}
              {dash.email.fromAddress ? ` · ${dash.email.fromAddress}` : ''}
            </span>
            {dash.email.keyMasked && (
              <span className="text-xs text-zinc-500">Key {dash.email.keyMasked}</span>
            )}
            <button onClick={() => setConfirming({ kind: 'disconnect', channel: 'EMAIL' })} className={secondaryBtnClass}>
              <Unplug size={13} /> {t(locale, 'messaging.disconnect')}
            </button>
          </div>
        ) : (
          <form action={emAction} className="space-y-3 max-w-lg">
            <p className="text-xs text-zinc-500">{t(locale, 'messaging.emailSetupHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t(locale, 'messaging.fromName')}>
                <input name="fromName" className={inputClass} placeholder="Acme Plumbing" />
              </Field>
              <Field label={t(locale, 'messaging.fromAddress')}>
                <input name="fromAddress" required type="email" className={inputClass} placeholder="hello@acme.ca" />
              </Field>
            </div>
            <Field label={t(locale, 'messaging.apiKey')}>
              <div className="relative">
                <input
                  name="apiKey"
                  required
                  type={showKey ? 'text' : 'password'}
                  className={`${inputClass} pr-12`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? t(locale, 't10misc.settings.hideValue') : t(locale, 't10misc.settings.showValue')}
                  aria-pressed={showKey}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
                >
                  {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            {emState.error && <p className="text-xs font-semibold text-rose-600">{emState.error}</p>}
            <button type="submit" className={primaryBtnClass}>
              {t(locale, 'messaging.connect')} Email
            </button>
            <p className="text-[11px] text-zinc-400">{t(locale, 'messaging.tokenSaved')}</p>
          </form>
        )}
      </Card>

      {/* Automations */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'messaging.automationsTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.automationsDesc')}</p>
        <form action={saveAction} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {TOGGLES.map((key) => (
              <label
                key={key}
                className="flex items-start gap-3 rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5 cursor-pointer hover:border-zinc-300"
              >
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={s[key]}
                  className="mt-1 h-4 w-4 accent-emerald-600"
                />
                <span>
                  <span className="block text-xs font-bold text-zinc-800">
                    {t(locale, `messaging.t_${key}` as Parameters<typeof t>[1])}
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    {t(locale, `messaging.d_${key}` as Parameters<typeof t>[1])}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2">
            <div className="rounded-xl border border-zinc-200/70 px-3 py-2.5">
              <p className="text-xs font-bold text-zinc-800 flex items-center gap-1.5 mb-1">
                <Clock size={13} className="text-zinc-400" /> {t(locale, 'messaging.quietTitle')}
              </p>
              <p className="text-[11px] text-zinc-500 mb-2">{t(locale, 'messaging.quietDesc')}</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-600">
                  {t(locale, 'messaging.quietStart')}{' '}
                  <input
                    name="quietStartHour"
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={s.quietStartHour}
                    className={`${inputClass} w-20`}
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  {t(locale, 'messaging.quietEnd')}{' '}
                  <input
                    name="quietEndHour"
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={s.quietEndHour}
                    className={`${inputClass} w-20`}
                  />
                </label>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="dryRun"
                defaultChecked={s.dryRun}
                className="mt-1 h-4 w-4 accent-amber-600"
              />
              <span>
                <span className="block text-xs font-bold text-zinc-800">
                  {t(locale, 'messaging.dryRunTitle')}
                </span>
                <span className="block text-[11px] text-zinc-500">
                  {t(locale, 'messaging.dryRunDesc')}
                </span>
              </span>
            </label>
          </div>

          {saveState.error && <p className="text-xs font-semibold text-rose-600">{saveState.error}</p>}
          {saveState.ok && <p className="text-xs font-semibold text-emerald-600">{t(locale, 'messaging.settingsSaved')}</p>}
          <button type="submit" className={primaryBtnClass}>
            {t(locale, 'messaging.saveSettings')}
          </button>
        </form>
      </Card>

      {/* Quota */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'messaging.quotaTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.quotaDesc')}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <QuotaBar used={dash.quota.whatsappUsed} limit={dash.quota.whatsappLimit} label={t(locale, 'messaging.whatsappUsage') + t(locale, 'messaging.perMonth')} />
          <QuotaBar used={dash.quota.emailUsed} limit={dash.quota.emailLimit} label={t(locale, 'messaging.emailUsage') + t(locale, 'messaging.perMonth')} />
        </div>
        <div className="mt-4 max-w-md">
          <QuotaBar used={dash.quota.emailDayUsed} limit={dash.quota.emailDayLimit} label={t(locale, 'messaging.emailDayUsage') + t(locale, 'messaging.perDay')} />
        </div>
        {dash.quota.blockedCount > 0 && (
          <p className="text-xs text-amber-700 font-semibold mt-3">
            {t(locale, 'messaging.blockedCount')}: {dash.quota.blockedCount}
          </p>
        )}
        <p className="text-[11px] text-zinc-400 mt-3">{t(locale, 'messaging.smsNote')}</p>
      </Card>

      {/* Preview & run */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'messaging.previewTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.previewDesc')}</p>
        <div className="flex flex-wrap gap-2 mb-2">
          <button onClick={doPreview} disabled={running} className={secondaryBtnClass}>
            <Eye size={13} /> {t(locale, 'messaging.previewButton')}
          </button>
          <button onClick={doRun} disabled={running} className={primaryBtnClass}>
            <Play size={13} /> {t(locale, 'messaging.runNowButton')}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 mb-3">{t(locale, 'messaging.runNowNote')}</p>
        {running && <p className="text-xs text-zinc-500">…</p>}
        {report && reportKind && (
          <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 text-xs">
            <p className="font-bold text-zinc-800 mb-2">
              {reportKind === 'preview' ? t(locale, 'messaging.previewButton') : t(locale, 'messaging.runNowButton')}:
              {' '}{report.evaluated} · {report.sent} {t(locale, 'messaging.reportSent')} · {report.failed} {t(locale, 'messaging.reportFailed')} ·{' '}
              {report.blockedQuota + report.blockedConsent + report.blockedNoContact} {t(locale, 'messaging.reportBlocked')} ·{' '}
              {report.deferredQuietHours} {t(locale, 'messaging.reportDeferred')}
              {report.dryRun && <> · {report.dryRunLogged} {t(locale, 'messaging.reportPreviewed')}</>}
            </p>
            {report.items.length > 0 ? (
              <ul className="space-y-1.5 max-h-64 overflow-auto">
                {report.items.map((it, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2 text-zinc-600">
                    <span className="font-semibold text-zinc-800">{it.customerName}</span>
                    <span>{t(locale, `messaging.tpl_${it.template}` as Parameters<typeof t>[1])}</span>
                    <span className="text-zinc-400">{it.channel}</span>
                    <span className="font-semibold">{statusLabel(it.status)}</span>
                    {it.detail && <span className="text-zinc-400 w-full">{it.detail}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500">{t(locale, 'messaging.logEmpty')}</p>
            )}
          </div>
        )}
      </Card>

      {/* Audit log */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'messaging.logTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'messaging.inboundNote')}</p>
        {dash.log.length === 0 ? (
          <p className="text-xs text-zinc-500">{t(locale, 'messaging.logEmpty')}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-400 border-b border-zinc-100">
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'messaging.colWhen')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'messaging.colChannel')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'messaging.colTo')}</th>
                    <th className="py-1.5 pr-2 font-semibold">{t(locale, 'messaging.colTemplate')}</th>
                    <th className="py-1.5 font-semibold">{t(locale, 'messaging.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.log.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-50">
                      <td className="py-1.5 pr-2 text-zinc-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
                      </td>
                      <td className="py-1.5 pr-2">{row.direction === 'IN' ? '←' : '→'} {row.type}</td>
                      <td className="py-1.5 pr-2">{row.customerName ?? row.recipient}</td>
                      <td className="py-1.5 pr-2">
                        {row.template ? t(locale, `messaging.tpl_${row.template}` as Parameters<typeof t>[1]) : '—'}
                      </td>
                      <td className="py-1.5 font-semibold">{statusLabel(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="space-y-2.5 md:hidden">
              {dash.log.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-zinc-200/70 bg-white p-3.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-zinc-800 truncate">
                      {row.customerName ?? row.recipient}
                    </p>
                    <span className="font-semibold text-zinc-600 shrink-0">{statusLabel(row.status)}</span>
                  </div>
                  <p className="text-zinc-500 mt-1">
                    {row.direction === 'IN' ? '←' : '→'} {row.type}
                    {row.template && (
                      <> · {t(locale, `messaging.tpl_${row.template}` as Parameters<typeof t>[1])}</>
                    )}
                  </p>
                  <p className="text-zinc-400 mt-1">
                    {new Date(row.createdAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <ConfirmDialog
        open={confirming !== null}
        locale={locale}
        title={
          confirming?.kind === 'run'
            ? t(locale, 't10misc.confirm.sendTitle')
            : t(locale, 't10misc.confirm.disconnectChannelTitle')
        }
        message={
          confirming?.kind === 'run'
            ? t(locale, 'messaging.confirmRun')
            : t(locale, 't10misc.confirm.disconnectChannelMsg')
        }
        confirmLabel={
          confirming?.kind === 'run'
            ? t(locale, 't10misc.confirm.yesSend')
            : t(locale, 't10misc.confirm.yesDisconnect')
        }
        onConfirm={() => {
          if (confirming?.kind === 'run') executeRun();
          else if (confirming?.kind === 'disconnect') void doDisconnect(confirming.channel);
        }}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
