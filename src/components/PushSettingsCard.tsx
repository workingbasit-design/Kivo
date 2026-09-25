'use client';

/**
 * Push notification settings card (per device).
 *
 * Lets the signed-in user enable/disable Web Push on *this* device and send
 * a test notification. Everything is free (browser push services, VAPID —
 * no paid provider), tenant-scoped, and degrades gracefully:
 *  - browser without PushManager → friendly "not supported" note
 *  - server without VAPID keys  → friendly "not set up" note
 *  - permission denied          → how to re-allow
 *
 * Mount in Settings where `locale` is available:
 *   <PushSettingsCard locale={locale} />
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Badge, Card, primaryBtnClass, secondaryBtnClass } from '@/components/ui';

type Status = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

/** VAPID keys are base64url — convert for PushManager.subscribe(). */
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
          <h3 className="font-bold text-zinc-900">{tr('cardTitle')}</h3>
          <p className="mt-1 text-sm text-zinc-600">{tr('cardDesc')}</p>
        </div>
        {status === 'on' && <Badge tone="success">{tr('statusOn')}</Badge>}
        {status === 'off' && <Badge tone="neutral">{tr('statusOff')}</Badge>}
      </div>

      <div className="mt-4">
        {status === 'loading' && (
          <p className="text-sm text-zinc-500" role="status">
            …
          </p>
        )}
        {status === 'unsupported' && (
          <p className="text-sm text-zinc-600">{tr('notSupported')}</p>
        )}
        {status === 'unconfigured' && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {tr('notConfigured')}
          </p>
        )}
        {status === 'denied' && (
          <div className="text-sm text-zinc-600 space-y-1">
            <p className="font-semibold text-zinc-800">{tr('denied')}</p>
            <p>{tr('deniedHelp')}</p>
          </div>
        )}
        {status === 'off' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className={primaryBtnClass}
            >
              <Bell size={16} />
              {busy ? tr('testing') : tr('enableBtn')}
            </button>
            <p className="text-xs text-zinc-500">{tr('enableHelp')}</p>
          </div>
        )}
        {status === 'on' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendTest}
              disabled={testing}
              className={primaryBtnClass}
            >
              <Send size={16} />
              {testing ? tr('testing') : tr('testBtn')}
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className={secondaryBtnClass}
            >
              <BellOff size={16} />
              {tr('disableBtn')}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
