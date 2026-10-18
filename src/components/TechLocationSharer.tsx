'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { useLocale } from './LanguageToggle';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Button,
  Card,
  Select,
  kitButtonClass,
} from '@/components/kit';

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

/** Fallback heartbeat when the OS delivers no position updates. */
const HEARTBEAT_INTERVAL_MS = 60_000;

type ShareState = 'idle' | 'starting' | 'sharing';

export default function TechLocationSharer({ jobs }: { jobs: SharableJob[] }) {
  const locale: Locale = useLocale();
  const tr = (path: string) => t(locale, path);
  const localeRef = useRef(locale);

  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [state, setState] = useState<ShareState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'info' | 'error'>('info');
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const timerRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const jobIdRef = useRef(jobId);
  const stateRef = useRef(state);

  // Keep the "latest value" mirrors in an effect - never during render.
  // (Async geolocation/fetch callbacks read these.)
  useEffect(() => {
    localeRef.current = locale;
    jobIdRef.current = jobId;
    stateRef.current = state;
  });

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
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
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
          // Job closed or not ours - stop, never keep pinging silently.
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

  /**
   * Keep the screen awake while sharing: iOS Safari throttles timers and
   * geolocation once the screen locks, which is the #1 cause of "map stopped
   * updating". Best-effort - silently ignored where unsupported.
   */
  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
      };
      if (!nav.wakeLock) return;
      wakeLockRef.current = await nav.wakeLock.request('screen');
    } catch {
      /* unsupported or denied - sharing still works while the screen is on */
    }
  }, []);

  const startWatching = useCallback(() => {
    stopTimer();
    // Primary: watchPosition delivers OS-level updates and survives far
    // better than interval polling when the page is backgrounded.
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        postPing(
          pos.coords.latitude,
          pos.coords.longitude,
          Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null
        ),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopSharing(t(localeRef.current, 'gps.permissionDenied'));
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 }
    );
    // Fallback heartbeat: if the OS goes quiet (no movement), still confirm
    // we're alive every 60s so the dispatcher sees a fresh timestamp.
    timerRef.current = window.setInterval(sendCurrentPosition, HEARTBEAT_INTERVAL_MS);
    void requestWakeLock();
  }, [postPing, stopSharing, sendCurrentPosition, stopTimer, requestWakeLock]);

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
            startWatching();
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
  }, [say, tr, startWatching]);

  // Never leak the timer, watch, or wake lock: stop sharing when the
  // component unmounts.
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

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

  // Reset link state during render when the selected job changes, so the
  // fetch effect below stays free of synchronous setState calls.
  const [prevJobId, setPrevJobId] = useState<string | null>(null);
  if (prevJobId !== jobId) {
    setPrevJobId(jobId);
    setLinkUrl(null);
    setLinkExpiresAt(null);
    setLinkBusy(jobId !== '');
  }

  // Load the existing active link for the selected job (if any) so a page
  // reload doesn't hide a link that's still valid.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
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
    setConfirmingRevoke(false);
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
      // Clipboard unavailable - the link is still visible to copy manually.
    }
  }, [linkUrl, say, tr]);

  const sharing = state === 'sharing';
  const starting = state === 'starting';

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-base font-bold text-ink">{tr('gps.shareCardTitle')}</h2>
          <p className="text-sm text-ink-2 mt-1">{tr('gps.shareCardDesc')}</p>
        </div>
        {/* Visible on-device indicator: impossible to miss while sharing. */}
        <span
          role="status"
          aria-live="polite"
          className={
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ' +
            (sharing
              ? 'bg-ok-bg text-ok'
              : 'bg-surface-2 text-ink-2')
          }
        >
          <span className="relative flex h-2.5 w-2.5">
            {sharing && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
            )}
            <span
              className={
                'relative inline-flex rounded-full h-2.5 w-2.5 ' +
                (sharing ? 'bg-ok' : 'bg-line')
              }
            />
          </span>
          {sharing ? tr('gps.sharingOn') : tr('gps.sharingOff')}
        </span>
      </div>

      {sharing && (
        <div className="mt-3 rounded-xl bg-ok-bg border border-line px-4 py-3">
          <p className="text-sm font-semibold text-ok">{tr('gps.sharingOn')}</p>
          <p className="text-xs text-ok mt-0.5">{tr('gps.sharingOnDetail')}</p>
          <p className="text-xs text-ok mt-1">
            {tr('gps.lastPing')}:{' '}
            {lastPingAt
              ? lastPingAt.toLocaleTimeString(locale === 'fr' ? 'fr-CA' : 'en-CA')
              : tr('gps.waitingForFix')}
          </p>
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-ink-2 mt-4">{tr('gps.noActiveJobs')}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <Select
            label={tr('gps.jobLabel')}
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={sharing || starting}
            options={jobs.map((j) => ({
              value: j.id,
              label: `${j.title} - ${j.customerName}`,
            }))}
          />

          {!sharing ? (
            <Button
              type="button"
              variant="primary"
              block
              onClick={startSharing}
              disabled={starting || !jobId}
            >
              {starting ? tr('gps.waitingForFix') : tr('gps.startSharing')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              block
              onClick={() => stopSharing(tr('gps.stopped'))}
            >
              {tr('gps.stopSharing')}
            </Button>
          )}

          <div className="rounded-xl bg-surface-2 border border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">{tr('gps.customerLinkTitle')}</p>
            <p className="text-xs text-ink-2 mt-0.5">{tr('gps.customerLinkDesc')}</p>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={createLink}
                disabled={linkBusy || !jobId}
              >
                {linkUrl ? tr('gps.refreshLink') : tr('gps.createLink')}
              </Button>
              {linkUrl && (
                <>
                  <Button type="button" variant="secondary" onClick={copyLink}>
                    {tr('gps.copyLink')}
                  </Button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${tr('gps.whatsappMessage')}: ${linkUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={kitButtonClass('secondary') + ' text-center'}
                  >
                    {tr('gps.shareWhatsApp')}
                  </a>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setConfirmingRevoke(true)}
                    disabled={linkBusy}
                  >
                    {tr('gps.revokeLink')}
                  </Button>
                </>
              )}
            </div>
            {linkUrl && (
              <>
                <p className="mt-2 text-xs break-all text-ink-2 select-all">{linkUrl}</p>
                {linkExpiresAt && (
                  <p className="mt-1 text-xs text-ink-2">
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

          <p className="text-[11px] text-ink-2">{tr('gps.privacyNote')}</p>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className={
            'mt-3 text-sm ' + (noticeKind === 'error' ? 'text-danger' : 'text-ink-2')
          }
        >
          {notice}
        </p>
      )}
      <ConfirmDialog
        open={confirmingRevoke}
        title={tr('gps.confirmRevokeTitle')}
        message={tr('gps.confirmRevoke')}
        busy={linkBusy}
        onConfirm={revokeLink}
        onClose={() => setConfirmingRevoke(false)}
      />
    </Card>
  );
}
