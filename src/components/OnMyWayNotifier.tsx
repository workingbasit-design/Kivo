'use client';

import React, { useRef, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';

function fill(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

/**
 * "On my way" customer notification. A <details> section with a pre-written
 * message plus SMS/WhatsApp buttons — the pro taps to send from their own
 * apps. EveryJob never sends anything automatically.
 *
 * The tracking link is fetched lazily (first open): reuse the existing
 * active link when there is one, otherwise POST /api/tracking/share to
 * create one. If the link can't be created, the message goes without it.
 */
export default function OnMyWayNotifier({
  jobId,
  jobTitle,
  customerName,
  phone,
  regionCode,
  businessName,
  techName,
  locale,
}: {
  jobId: string;
  jobTitle: string;
  customerName: string;
  phone: string | null | undefined;
  regionCode?: string | null;
  businessName: string;
  techName: string;
  locale: Locale;
}) {
  const tr = (k: string) => t(locale, `jobops.notify.${k}`);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const fetchedRef = useRef(false);

  async function ensureLink() {
    if (fetchedRef.current || busy) return;
    fetchedRef.current = true;
    setBusy(true);
    try {
      // Prefer the existing active link so a previously sent link keeps
      // working; only create a fresh token when there is none.
      let url: string | null = null;
      const existing = await fetch(
        `/api/tracking/share?jobId=${encodeURIComponent(jobId)}`
      );
      if (existing.ok) {
        const data = (await existing.json()) as { url: string | null };
        if (data.url) url = `${window.location.origin}${data.url}`;
      }
      if (!url) {
        const created = await fetch('/api/tracking/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        });
        if (!created.ok) throw new Error(`share ${created.status}`);
        const data = (await created.json()) as { token: string };
        url = `${window.location.origin}/track/${data.token}`;
      }
      setTrackUrl(url);
    } catch {
      setLinkFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const message = trackUrl
    ? fill(tr('message'), {
        customerName,
        businessName,
        techName,
        jobTitle,
        trackLink: trackUrl,
      })
    : fill(tr('messageNoLink'), { customerName, businessName, techName, jobTitle });

  return (
    <details
      className="group"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) void ensureLink();
      }}
    >
      <summary className="flex items-center gap-2 text-sm font-bold text-zinc-900 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-sky-500/10 text-sky-700 shrink-0">
          <BellRing size={15} />
        </span>
        {tr('title')}
        <span className="ml-auto text-zinc-400 text-xs font-semibold group-open:hidden">
          ▸
        </span>
        <span className="ml-auto text-zinc-400 text-xs font-semibold hidden group-open:inline">
          ▾
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        <p className="text-xs text-zinc-500">{tr('summary')}</p>

        {busy && (
          <p className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 size={13} className="animate-spin" /> {tr('gettingLink')}
          </p>
        )}
        {linkFailed && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            {tr('linkHint')}
          </p>
        )}
        {trackUrl && (
          <p className="text-xs text-zinc-600 break-all bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 select-all">
            {trackUrl}
          </p>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            {tr('preview')}
          </p>
          <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SmsButton
            phone={phone}
            message={message}
            regionCode={regionCode}
            label={tr('smsLabel')}
          />
          <WhatsAppButton
            phone={phone}
            message={message}
            regionCode={regionCode}
            label={tr('whatsappLabel')}
          />
        </div>
        {!phone && <p className="text-xs text-zinc-400">{tr('noPhone')}</p>}
      </div>
    </details>
  );
}
