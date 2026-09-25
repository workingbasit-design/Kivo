'use client';

import { useEffect, useState } from 'react';
import { PlugZap, Unplug, RefreshCw, CheckCircle2, XCircle, MinusCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Badge, Card, dangerBtnClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';

interface SyncItemResult {
  entityType: 'customer' | 'invoice' | 'payment';
  entityId: string;
  label: string;
  status: 'synced' | 'failed' | 'skipped';
  qbId?: string;
  detail?: string;
}

interface SyncBucket {
  synced: number;
  failed: number;
  skipped: number;
}

interface SyncResult {
  ok: boolean;
  summary: { customer: SyncBucket; invoice: SyncBucket; payment: SyncBucket };
  items: SyncItemResult[];
}

const ENTITY_LABEL: Record<SyncItemResult['entityType'], string> = {
  customer: 'Customers',
  invoice: 'Invoices',
  payment: 'Payments',
};

function StatusIcon({ status }: { status: SyncItemResult['status'] }) {
  if (status === 'synced') return <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />;
  if (status === 'failed') return <XCircle size={14} className="text-rose-600 shrink-0" />;
  return <MinusCircle size={14} className="text-amber-600 shrink-0" />;
}

/**
 * QuickBooks Online sync card for Settings.
 * Props come from the parent server component (connection status + last sync);
 * syncing/disconnecting happen through the /api/integrations/quickbooks routes.
 */
export default function QuickBooksCard({
  locale,
  initialConnected,
  initialLastSyncAt,
  sandbox,
}: {
  locale: Locale;
  initialConnected: boolean;
  initialLastSyncAt: string | null;
  sandbox: boolean;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialLastSyncAt);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [callbackUri, setCallbackUri] = useState('');

  // Surface the OAuth callback outcome (?quickbooks=connected|denied|…) once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('quickbooks');
    if (!code) return;
    setCallbackUri(`${window.location.origin}/api/integrations/quickbooks/callback`);
    const key =
      code === 'connected'
        ? 'statusConnected'
        : code === 'denied'
          ? 'statusDenied'
          : code === 'invalid-state'
            ? 'statusInvalid'
            : code === 'rate-limited'
              ? 'statusRateLimited'
              : 'statusError';
    setBanner({
      kind: code === 'connected' ? 'ok' : code === 'not-configured' ? 'warn' : 'error',
      text: t(locale, `quickbooks.${key}`),
    });
    if (code === 'connected') setConnected(true);
    params.delete('quickbooks');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState(null, '', clean);
  }, [locale]);

  useEffect(() => {
    if (!callbackUri) setCallbackUri(`${window.location.origin}/api/integrations/quickbooks/callback`);
  }, [callbackUri]);

  async function doSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await fetch('/api/integrations/quickbooks/sync', { method: 'POST' });
      const data = (await res.json()) as SyncResult & { error?: string };
      if (!res.ok || !data.ok) {
        setBanner({ kind: 'error', text: data.error ?? t(locale, 'quickbooks.statusError') });
        return;
      }
      setResult(data);
      setLastSyncAt(new Date().toISOString());
      toast.success(t(locale, 'quickbooks.syncStarted'));
    } catch {
      setBanner({ kind: 'error', text: t(locale, 'quickbooks.statusError') });
    } finally {
      setSyncing(false);
    }
  }

  async function doDisconnect() {
    setConfirming(false);
    try {
      const res = await fetch('/api/integrations/quickbooks/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error();
      setConnected(false);
      setResult(null);
      setLastSyncAt(null);
      toast.success(t(locale, 'quickbooks.disconnected'));
    } catch {
      toast.error(t(locale, 'quickbooks.statusError'));
    }
  }

  const bannerClass =
    banner?.kind === 'ok'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : banner?.kind === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-rose-50 text-rose-800 border-rose-200';

  const notable = result?.items.filter((i) => i.status !== 'synced') ?? [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-zinc-900">{t(locale, 'quickbooks.cardTitle')}</h3>
          <p className="text-sm text-zinc-500 mt-1">{t(locale, 'quickbooks.cardDesc')}</p>
        </div>
        <Badge tone={connected ? 'success' : 'neutral'}>
          {connected ? t(locale, 'quickbooks.connected') : t(locale, 'quickbooks.notConnected')}
        </Badge>
      </div>

      {sandbox && connected && (
        <p className="mt-3 inline-block text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          {t(locale, 'quickbooks.sandboxBadge')}
        </p>
      )}

      {banner && (
        <p className={`mt-4 text-sm px-3 py-2.5 rounded-xl border ${bannerClass}`}>{banner.text}</p>
      )}

      {/* Setup instructions when the Intuit app isn't configured yet. */}
      {banner?.kind === 'warn' && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 space-y-2">
          <p className="font-bold text-zinc-900">{t(locale, 'quickbooks.setupTitle')}</p>
          <p>{t(locale, 'quickbooks.setupIntro')}</p>
          <ol className="list-decimal ml-5 space-y-1.5">
            <li>
              {t(locale, 'quickbooks.setupStep1')}{' '}
              <a
                href="https://developer.intuit.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
              >
                developer.intuit.com <ExternalLink size={12} />
              </a>
            </li>
            <li>
              {t(locale, 'quickbooks.setupStep2')}
              <code className="block mt-1 px-2 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs break-all select-all">
                {callbackUri}
              </code>
            </li>
            <li>{t(locale, 'quickbooks.setupStep3')}</li>
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!connected ? (
          <button
            type="button"
            onClick={() => (window.location.href = '/api/integrations/quickbooks/connect')}
            className={primaryBtnClass}
          >
            <PlugZap size={16} /> {t(locale, 'quickbooks.connectBtn')}
          </button>
        ) : (
          <>
            <button type="button" onClick={doSync} disabled={syncing} className={primaryBtnClass}>
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />{' '}
              {syncing ? t(locale, 'quickbooks.syncing') : t(locale, 'quickbooks.syncNowBtn')}
            </button>
            <button type="button" onClick={() => setConfirming(true)} className={secondaryBtnClass}>
              <Unplug size={16} /> {t(locale, 'quickbooks.disconnectBtn')}
            </button>
          </>
        )}
      </div>

      {connected && (
        <p className="mt-3 text-xs text-zinc-500">
          {t(locale, 'quickbooks.lastSync')}:{' '}
          {lastSyncAt
            ? new Date(lastSyncAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA')
            : t(locale, 'quickbooks.never')}
        </p>
      )}

      {/* Per-run summary: every entity accounted for. */}
      {result && (
        <div className="mt-4 rounded-xl border border-zinc-200 overflow-hidden">
          <p className="px-4 py-2.5 bg-zinc-50 text-sm font-bold text-zinc-800 border-b border-zinc-200">
            {t(locale, 'quickbooks.summaryTitle')}
          </p>
          <div className="divide-y divide-zinc-100">
            {(Object.keys(result.summary) as Array<keyof SyncResult['summary']>).map((k) => {
              const b = result.summary[k];
              return (
                <div key={k} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-zinc-700">{ENTITY_LABEL[k]}</span>
                  <span className="flex gap-3 text-xs">
                    <span className="text-emerald-700 font-semibold">
                      {b.synced} {t(locale, 'quickbooks.synced').toLowerCase()}
                    </span>
                    <span className="text-amber-700 font-semibold">
                      {b.skipped} {t(locale, 'quickbooks.skipped').toLowerCase()}
                    </span>
                    <span className="text-rose-700 font-semibold">
                      {b.failed} {t(locale, 'quickbooks.failed').toLowerCase()}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          {result.items.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">{t(locale, 'quickbooks.noItems')}</p>
          )}
          {notable.length > 0 && (
            <ul className="px-4 py-2 space-y-2 bg-amber-50/50 border-t border-zinc-200">
              {notable.slice(0, 20).map((i) => (
                <li key={`${i.entityType}-${i.entityId}`} className="flex items-start gap-2 text-xs">
                  <StatusIcon status={i.status} />
                  <span>
                    <span className="font-semibold text-zinc-800">{i.label}</span>
                    <span className="text-zinc-500"> — {i.detail}</span>
                  </span>
                </li>
              ))}
              {notable.length > 20 && (
                <li className="text-xs text-zinc-500">+{notable.length - 20} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t(locale, 'quickbooks.disconnectTitle')}
        message={t(locale, 'quickbooks.disconnectMsg')}
        confirmLabel={t(locale, 'quickbooks.disconnectBtn')}
        locale={locale}
        onConfirm={doDisconnect}
        onClose={() => setConfirming(false)}
      />
    </Card>
  );
}
