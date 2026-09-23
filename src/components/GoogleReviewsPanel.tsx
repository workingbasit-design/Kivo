'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  Unplug,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import {
  listGoogleLocations,
  selectGoogleLocation,
  syncGoogleReviews,
  disconnectGoogle,
  type GoogleStatus,
} from '@/app/actions/google-reviews';
import { googleErrorMessage, type GoogleErrorKind } from '@/lib/google-reviews';
import { Card } from '@/components/ui';

const G = (locale: Locale, key: string) => t(locale, `googleReviews.${key}`);

function SetupChecklist({ locale }: { locale: Locale }) {
  const steps = [
    G(locale, 'setupStep1'),
    G(locale, 'setupStep2'),
    G(locale, 'setupStep3'),
    G(locale, 'setupStep4'),
  ];
  return (
    <div className="text-xs text-zinc-600 space-y-2">
      <p className="font-bold text-zinc-900 text-sm">{G(locale, 'setupTitle')}</p>
      <ol className="list-decimal ml-4 space-y-1.5">
        {steps.slice(0, 2).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
        <li>
          {steps[2]}
          <code className="block mt-1 bg-smoke rounded-lg px-2 py-1.5 font-mono text-[11px] text-ink break-all">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/google/callback` : '/api/google/callback'}
          </code>
        </li>
        <li>{steps[3]}</li>
      </ol>
      <p className="text-zinc-400">{G(locale, 'setupNote')}</p>
    </div>
  );
}

function statusMessage(locale: Locale, param: string | null): { ok: boolean; text: string } | null {
  switch (param) {
    case 'connected':
      return { ok: true, text: G(locale, 'statusConnected') };
    case 'denied':
      return { ok: false, text: G(locale, 'statusDenied') };
    case 'not-configured':
      return { ok: false, text: G(locale, 'statusNotConfigured') };
    default:
      return param ? { ok: false, text: G(locale, 'statusError') } : null;
  }
}

export default function GoogleReviewsPanel({
  status,
  locale,
}: {
  status: GoogleStatus;
  locale: Locale;
}) {
  const searchParams = useSearchParams();
  const fr = locale === 'fr';
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(() =>
    statusMessage(locale, searchParams.get('google'))
  );
  const [locations, setLocations] = useState<{ locationId: string; title: string }[] | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [connectedState, setConnectedState] = useState(status);

  useEffect(() => {
    if (connectedState.connected && !connectedState.hasLocation) loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocations() {
    setLocLoading(true);
    setLocError(null);
    const res = await listGoogleLocations();
    setLocLoading(false);
    if (res.ok && res.locations) {
      setLocations(res.locations);
      if (res.locations.length === 0) setLocError(G(locale, 'noLocations'));
    } else {
      setLocError(
        res.errorKind
          ? googleErrorMessage(res.errorKind as GoogleErrorKind, fr)
          : res.error ?? G(locale, 'loadLocationsError')
      );
    }
  }

  function doSync() {
    startSync(async () => {
      const res = await syncGoogleReviews();
      if (res.ok) {
        const imported = res.imported ?? 0;
        const skipped = res.skipped ?? 0;
        setMsg({
          ok: true,
          text: `${G(locale, 'synced')} — ${imported} ${G(locale, 'newReviews')}${
            skipped ? `, ${skipped} ${G(locale, 'alreadyHere')}` : ''
          }.`,
        });
        setConnectedState((s) => ({ ...s, lastSyncAt: new Date().toISOString() }));
      } else {
        setMsg({
          ok: false,
          text: res.errorKind
            ? googleErrorMessage(res.errorKind, fr)
            : res.error ?? G(locale, 'syncFailed'),
        });
      }
    });
  }

  function doSelectLocation(formData: FormData) {
    startSync(async () => {
      const res = await selectGoogleLocation({}, formData);
      if (res.ok) {
        setMsg({ ok: true, text: G(locale, 'locationSaved') });
        setConnectedState((s) => ({ ...s, hasLocation: true }));
      } else {
        setMsg({
          ok: false,
          text: res.errorKind
            ? googleErrorMessage(res.errorKind, fr)
            : res.error ?? G(locale, 'couldNotSave'),
        });
      }
    });
  }

  function doDisconnect() {
    if (!confirm(G(locale, 'disconnectConfirm'))) return;
    startDisconnect(async () => {
      await disconnectGoogle();
      setConnectedState({
        configured: status.configured,
        connected: false,
        hasLocation: false,
        locationName: null,
        lastSyncAt: null,
        googleAccountId: null,
      });
      setMsg({ ok: true, text: G(locale, 'disconnected') });
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        <h3 className="font-bold text-sm text-zinc-900">{G(locale, 'title')}</h3>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 text-xs font-medium rounded-xl px-3 py-2.5 mb-3 ${msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
          {msg.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {!connectedState.configured ? (
        <SetupChecklist locale={locale} />
      ) : !connectedState.connected ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600">{G(locale, 'connectDesc')}</p>
          <a
            href="/api/google/connect"
            className="inline-flex items-center gap-2 bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-bold text-xs"
          >
            <ExternalLink size={13} /> {G(locale, 'connectButton')}
          </a>
        </div>
      ) : !connectedState.hasLocation ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-600 font-semibold">{G(locale, 'pickTitle')}</p>
          {locLoading && <p className="text-xs text-zinc-500">{G(locale, 'loadingLocations')}</p>}
          {locError && <p className="text-xs text-rose-600">{locError}</p>}
          {locations && locations.length > 0 && (
            <div className="space-y-2">
              {locations.map((l) => (
                <form key={l.locationId} action={doSelectLocation} className="flex items-center justify-between gap-2 bg-paper border border-zinc-200/60 rounded-xl px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800 min-w-0">
                    <MapPin size={13} className="text-zinc-400 shrink-0" />
                    <span className="truncate">{l.title}</span>
                  </span>
                  <input type="hidden" name="locationId" value={l.locationId} />
                  <input type="hidden" name="title" value={l.title} />
                  <button type="submit" className="text-xs font-bold text-ink hover:underline shrink-0">
                    {G(locale, 'useThis')}
                  </button>
                </form>
              ))}
            </div>
          )}
          {!locLoading && (
            <button onClick={loadLocations} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
              {G(locale, 'reloadLocations')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600">
            {connectedState.locationName
              ? G(locale, 'connectedAs').replace('{name}', connectedState.locationName)
              : G(locale, 'connectedNoName')}
            {connectedState.lastSyncAt && (
              <>
                {' '}
                {G(locale, 'lastSync').replace(
                  '{when}',
                  new Date(connectedState.lastSyncAt).toLocaleString(
                    fr ? 'fr-CA' : 'en-CA'
                  )
                )}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={doSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-60"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? G(locale, 'syncing') : G(locale, 'syncNow')}
            </button>
            <button
              onClick={doDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-500 text-zinc-600 px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-60"
            >
              <Unplug size={13} /> {G(locale, 'disconnect')}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">{G(locale, 'syncNote')}</p>
        </div>
      )}
    </Card>
  );
}
