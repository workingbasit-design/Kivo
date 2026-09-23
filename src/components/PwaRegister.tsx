'use client';

/**
 * PWA bootstrap component. Mount once near the top of the app shell:
 *
 *   <PwaRegister />
 *
 * - Registers /sw.js (offline-first service worker).
 * - Injects <link rel="manifest">, theme-color and apple-touch-icon tags.
 * - Shows a small sync pill when offline or when the outbox has pending items.
 *
 * NOTE: this component is intentionally not mounted anywhere yet — the app
 * shell is being redesigned in parallel. Mount it in the root layout.
 */
import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  onOutboxStatus,
  startOutboxSync,
  type OutboxStatus,
} from '@/lib/offline/outbox';

function ensureHeadTags() {
  const head = document.head;
  const link = (rel: string, href: string, extra: Record<string, string> = {}) => {
    if (head.querySelector(`link[rel="${rel}"]`)) return;
    const el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
    head.appendChild(el);
  };
  const meta = (name: string, content: string) => {
    if (head.querySelector(`meta[name="${name}"]`)) return;
    const el = document.createElement('meta');
    el.name = name;
    el.content = content;
    head.appendChild(el);
  };
  link('manifest', '/manifest.webmanifest');
  link('apple-touch-icon', '/icons/apple-touch-icon.png');
  meta('theme-color', '#161616');
  meta('mobile-web-app-capable', 'yes');
  meta('apple-mobile-web-app-capable', 'yes');
  meta('apple-mobile-web-app-status-bar-style', 'default');
}

export default function PwaRegister() {
  const [online, setOnline] = useState(true);
  const [outbox, setOutbox] = useState<OutboxStatus>({ pending: 0, syncing: false, lastError: null });
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    ensureHeadTags();

    // Service worker registration — silent on failure (private mode etc.).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    const unsub = onOutboxStatus((s) => {
      setOutbox((prev) => {
        if (prev.pending > 0 && s.pending === 0 && !s.syncing) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 4000);
        }
        return s;
      });
    });

    // Auto-sync queued jobs. The submitter posts the queued payload to the
    // job-creation endpoint; jobs created while offline are plain JSON.
    const stopSync = startOutboxSync(async (payload) => {
      const res = await fetch('/api/offline-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    });

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsub();
      stopSync();
    };
  }, []);

  const showOffline = !online;
  const showPending = online && outbox.pending > 0;
  const showSyncing = outbox.syncing;
  const showDone = justSynced && online && outbox.pending === 0;

  if (!showOffline && !showPending && !showSyncing && !showDone) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-4 md:right-6 z-50 flex items-center gap-2 rounded-full bg-zinc-900/95 text-white pl-3 pr-4 py-2 text-xs font-semibold shadow-xl backdrop-blur"
    >
      {showOffline && (
        <>
          <CloudOff size={14} className="text-amber-400" />
          <span>Offline — work will sync later</span>
        </>
      )}
      {showSyncing && (
        <>
          <RefreshCw size={14} className="animate-spin text-sky-400" />
          <span>Syncing {outbox.pending}…</span>
        </>
      )}
      {!showOffline && !showSyncing && showPending && (
        <>
          <CloudOff size={14} className="text-amber-400" />
          <span>{outbox.pending} waiting to sync</span>
        </>
      )}
      {showDone && (
        <>
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>All synced</span>
        </>
      )}
    </div>
  );
}
