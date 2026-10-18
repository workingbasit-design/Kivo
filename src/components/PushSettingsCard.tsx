'use client';

/**
 * Push notification settings card (per device).
 *
 * Lets the signed-in user enable/disable Web Push on *this* device and send
 * a test notification. Everything is free (browser push services, VAPID -
 * no paid provider), tenant-scoped, and degrades gracefully:
 *  - browser without PushManager → friendly "not supported" note
 *  - server without VAPID keys  → friendly "not set up" note
 *  - permission denied          → how to re-allow
 *
 * Mount in Settings where `locale` is available:
 *   <PushSettingsCard locale={locale} />
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, StatusBadge } from '@/components/kit';

type Status = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

/** VAPID keys are base64url - convert for PushManager.subscribe(). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function vapidPublicKey(): Promise<string | null> {
  const res = await fetch('/api/push/vapid-public-key');
  if (!res.ok) return null;
  const data = (await res.json()) as { configured?: boolean; publicKey?: string | null };
  return data.configured && data.publicKey ? data.publicKey : null;
}

export default function PushSettingsCard({ locale = 'en' }: { locale?: Locale }) {
  const tr = (p: string) => t(locale, `pwa.push.${p}`);
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      const key = await vapidPublicKey().catch(() => null);
      if (cancelled) return;
      if (!key) {
        setStatus('unconfigured');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      const key = await vapidPublicKey();
      if (!key) {
        setStatus('unconfigured');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setStatus('on');
      toast.success(tr('enabledToast'));
    } catch {
      toast.error(tr('subscribeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      const endpoint = sub?.endpoint ?? null;
      if (sub) await sub.unsubscribe().catch(() => undefined);
      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => undefined);
      }
      setStatus('off');
      toast.success(tr('disabledToast'));
    } catch {
      toast.error(tr('subscribeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { configured?: boolean };
      if (!res.ok) throw new Error('test failed');
      if (data.configured === false) {
        setStatus('unconfigured');
        toast.error(tr('notConfigured'));
        return;
      }
      toast.success(tr('testSent'));
    } catch {
      toast.error(tr('testFailed'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">{tr('cardTitle')}</h3>
          <p className="mt-1 text-sm text-ink-2">{tr('cardDesc')}</p>
        </div>
        {status === 'on' && <StatusBadge tone="done">{tr('statusOn')}</StatusBadge>}
        {status === 'off' && <StatusBadge tone="neutral">{tr('statusOff')}</StatusBadge>}
      </div>

      <div className="mt-4">
        {status === 'loading' && (
          <p className="text-sm text-ink-2" role="status">
            …
          </p>
        )}
        {status === 'unsupported' && (
          <p className="text-sm text-ink-2">{tr('notSupported')}</p>
        )}
        {status === 'unconfigured' && (
          <p className="text-sm text-warn-text bg-warn-bg border border-warn-line rounded-xl px-3 py-2">
            {tr('notConfigured')}
          </p>
        )}
        {status === 'denied' && (
          <div className="text-sm text-ink-2 space-y-1">
            <p className="font-semibold text-ink">{tr('denied')}</p>
            <p>{tr('deniedHelp')}</p>
          </div>
        )}
        {status === 'off' && (
          <div className="space-y-3">
            <Button
              type="button"
              variant="primary"
              onClick={enable}
              disabled={busy}
            >
              <Bell size={16} />
              {busy ? tr('testing') : tr('enableBtn')}
            </Button>
            <p className="text-xs text-ink-2">{tr('enableHelp')}</p>
          </div>
        )}
        {status === 'on' && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={sendTest}
              disabled={testing}
            >
              <Send size={16} />
              {testing ? tr('testing') : tr('testBtn')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={disable}
              disabled={busy}
            >
              <BellOff size={16} />
              {tr('disableBtn')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
