'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { useLocale } from './LanguageToggle';
import {
  Card,
  Field,
  dangerBtnClass,
  primaryBtnClass,
  secondaryBtnClass,
  selectClass,
} from '@/components/ui';

/**
 * Technician live-location sharing card.
 *
 * Privacy-first by construction:
 * - Nothing is recorded until the tech taps "Start sharing" for a specific
 *   active job (explicit opt-in, per job).
 * - While sharing, a prominent pulsing indicator stays visible on screen.
 * - The server rejects pings for jobs that are no longer SCHEDULED /
 *   IN PROGRESS, so sharing auto-stops the moment a job closes.
 * - Pings older than 24h are deleted by the nightly cron.
 */

export interface SharableJob {
  id: string;
  title: string;
  customerName: string;
  address?: string | null;
}

const PING_INTERVAL_MS = 15_000;

type ShareState = 'idle' | 'starting' | 'sharing';

export default function TechLocationSharer({ jobs }: { jobs: SharableJob[] }) {
  const locale: Locale = useLocale();
  const tr = (path: string) => t(locale, path);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [state, setState] = useState<ShareState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'info' | 'error'>('info');
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const timerRef = useRef<number | null>(null);
  const jobIdRef = useRef(jobId);
  jobIdRef.current = jobId;
  const stateRef = useRef(state);
  stateRef.current = state;

  const say = useCallback(
    (kind: 'info' | 'error', msg: string) => {
      setNoticeKind(kind);
      setNotice(msg);
    },
    []
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopSharing = useCallback(
    (msg?: string) => {
      stopTimer();
      setState('idle');
      setLastPingAt(null);
      if (msg) say('info', msg);
    },
    [stopTimer, say]
  );

  const postPing = useCallback(
    async (lat: number, lng: number, accuracy: number | null) => {
      try {
        const res = await fetch('/api/locations/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            accuracy: accuracy ?? undefined,
            jobId: jobIdRef.current,
          }),
        });
        if (res.status === 403) {
          // Job closed or not ours — stop, never keep pinging silently.
          stopSharing(t(localeRef.current, 'gps.jobInactive'));
          return;
        }
        if (!res.ok) throw new Error(`ping ${res.status}`);
        setLastPingAt(new Date());
      } catch {
        // Keep trying on transient failures; the visible indicator stays on
        // so the tech knows sharing is still attempted.
      }
    },
    [stopSharing]
  );

  const sendCurrentPosition = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        postPing(
          pos.coords.latitude,
          pos.coords.longitude,
          Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null
        ),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopSharing(t(locale, 'gps.permissionDenied'));
        }
        // Other errors: keep the cadence going; GPS often recovers.
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 }
    );
  }, [postPing, stopSharing, locale]);

  const startSharing = useCallback(() => {
    if (!('geolocation' in navigator)) {
      say('error', tr('gps.notSupported'));
      return;
    }
    if (!jobIdRef.current) return;
    setState('starting');
    say('info', tr('gps.waitingForFix'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // First ping must succeed before we claim to be sharing.
        fetch('/api/locations/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : undefined,
            jobId: jobIdRef.current,
          }),
        })
          .then((res) => {
            if (res.status === 403) {
              setState('idle');
              say('error', tr('gps.jobInactive'));
              return;
            }
            if (!res.ok) throw new Error(`ping ${res.status}`);
            setState('sharing');
            setLastPingAt(new Date());
            say('info', tr('gps.started'));
            stopTimer();
            timerRef.current = window.setInterval(
              sendCurrentPosition,
              PING_INTERVAL_MS
            );
          })
          .catch(() => {
            setState('idle');
            say('error', tr('gps.pingFailed'));
          });
      },
      (err) => {
        setState('idle');
        if (err.code === err.PERMISSION_DENIED) say('error', tr('gps.permissionDenied'));
        else if (err.code === err.TIMEOUT) say('error', tr('gps.timeout'));
        else say('error', tr('gps.unavailable'));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }
    );
  }, [say, tr, sendCurrentPosition, stopTimer]);

  // Never leak the timer: stop sharing when the component unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const createLink = useCallback(async () => {
    if (!jobIdRef.current || linkBusy) return;
    setLinkBusy(true);
    try {
      const res = await fetch('/api/tracking/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobIdRef.current }),
      });
      if (!res.ok) throw new Error(`share ${res.status}`);
      const data = (await res.json()) as { url: string; expiresAt?: string };
      setLinkUrl(`${window.location.origin}${data.url}`);
      setLinkExpiresAt(data.expiresAt ?? null);
      setNotice(null);
    } catch {
      say('error', tr('gps.pingFailed'));
    } finally {
      setLinkBusy(false);
    }
  }, [linkBusy, say, tr]);

  // Load the existing active link for the selected job (if any) so a page
  // reload doesn't hide a link that's still valid.
  useEffect(() => {
    if (!jobId) {
      setLinkUrl(null);
      setLinkExpiresAt(null);
      return;
    }
    let cancelled = false;
    setLinkBusy(true);
    fetch(`/api/tracking/share?jobId=${encodeURIComponent(jobId)}`)
      .then((res) => (res.ok ? res.json() : { url: null }))
      .then((data: { url: string | null; expiresAt?: string }) => {
        if (cancelled) return;
        setLinkUrl(data.url ? `${window.location.origin}${data.url}` : null);
        setLinkExpiresAt(data.expiresAt ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setLinkUrl(null);
          setLinkExpiresAt(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLinkBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const revokeLink = useCallback(async () => {
    if (!jobIdRef.current || linkBusy) return;
    if (!window.confirm(tr('gps.confirmRevoke'))) return;
    setLinkBusy(true);
    try {
      const res = await fetch(
        `/api/tracking/share?jobId=${encodeURIComponent(jobIdRef.current)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`revoke ${res.status}`);
      setLinkUrl(null);
      setLinkExpiresAt(null);
      say('info', tr('gps.revoked'));
    } catch {
      say('error', tr('gps.pingFailed'));
    } finally {
      setLinkBusy(false);
    }
  }, [linkBusy, say, tr]);

  const copyLink = useCallback(async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      say('info', tr('gps.copied'));
    } catch {
      // Clipboard unavailable — the link is still visible to copy manually.
    }
  }, [linkUrl, say, tr]);

  const sharing = state === 'sharing';
  const starting = state === 'starting';

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-base font-bold text-zinc-900">{tr('gps.shareCardTitle')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{tr('gps.shareCardDesc')}</p>
        </div>
        {/* Visible on-device indicator: impossible to miss while sharing. */}
        <span
          role="status"
          aria-live="polite"
          className={
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ' +
            (sharing
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-zinc-100 text-zinc-500')
          }
        >
          <span className="relative flex h-2.5 w-2.5">
            {sharing && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={
                'relative inline-flex rounded-full h-2.5 w-2.5 ' +
                (sharing ? 'bg-emerald-600' : 'bg-zinc-400')
              }
            />
          </span>
          {sharing ? tr('gps.sharingOn') : tr('gps.sharingOff')}
        </span>
      </div>

      {sharing && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">{tr('gps.sharingOn')}</p>
          <p className="text-xs text-emerald-700 mt-0.5">{tr('gps.sharingOnDetail')}</p>
          <p className="text-xs text-emerald-700 mt-1">
            {tr('gps.lastPing')}:{' '}
            {lastPingAt
              ? lastPingAt.toLocaleTimeString(locale === 'fr' ? 'fr-CA' : 'en-CA')
              : tr('gps.waitingForFix')}
          </p>
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500 mt-4">{tr('gps.noActiveJobs')}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <Field label={tr('gps.jobLabel')}>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              disabled={sharing || starting}
              className={selectClass}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.customerName}
                </option>
              ))}
            </select>
          </Field>

          {!sharing ? (
            <button
              type="button"
              onClick={startSharing}
              disabled={starting || !jobId}
              className={primaryBtnClass + ' w-full !py-3.5 !text-base'}
            >
              {starting ? tr('gps.waitingForFix') : tr('gps.startSharing')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => stopSharing(tr('gps.stopped'))}
              className={dangerBtnClass + ' w-full !py-3.5 !text-base'}
            >
              {tr('gps.stopSharing')}
            </button>
          )}

          <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-800">{tr('gps.customerLinkTitle')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{tr('gps.customerLinkDesc')}</p>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={createLink}
                disabled={linkBusy || !jobId}
                className={secondaryBtnClass}
              >
                {linkUrl ? tr('gps.refreshLink') : tr('gps.createLink')}
              </button>
              {linkUrl && (
                <>
                  <button type="button" onClick={copyLink} className={secondaryBtnClass}>
                    {tr('gps.copyLink')}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${tr('gps.whatsappMessage')}: ${linkUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={secondaryBtnClass + ' text-center'}
                  >
                    {tr('gps.shareWhatsApp')}
                  </a>
                  <button
                    type="button"
                    onClick={revokeLink}
                    disabled={linkBusy}
                    className={dangerBtnClass}
                  >
                    {tr('gps.revokeLink')}
                  </button>
                </>
              )}
            </div>
            {linkUrl && (
              <>
                <p className="mt-2 text-xs break-all text-zinc-600 select-all">{linkUrl}</p>
                {linkExpiresAt && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {tr('gps.linkExpires')}:{' '}
                    {new Date(linkExpiresAt).toLocaleString(
                      locale === 'fr' ? 'fr-CA' : 'en-CA',
                      { dateStyle: 'medium', timeStyle: 'short' }
                    )}
                  </p>
                )}
              </>
            )}
          </div>

          <p className="text-[11px] text-zinc-400">{tr('gps.privacyNote')}</p>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className={
            'mt-3 text-sm ' + (noticeKind === 'error' ? 'text-rose-700' : 'text-zinc-600')
          }
        >
          {notice}
        </p>
      )}
    </Card>
  );
}
