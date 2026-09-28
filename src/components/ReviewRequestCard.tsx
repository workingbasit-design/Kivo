'use client';

import React, { useEffect, useState } from 'react';
import { Check, Link2, Loader2, Star } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card } from '@/components/ui';
import { createReviewRequest } from '@/app/actions/review-requests';
import SmsButton from '@/components/SmsButton';
import WhatsAppButton from '@/components/WhatsAppButton';

function fill(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

/**
 * Post-job review request card (COMPLETED jobs only). Creates the
 * server-moated single-use review link via createReviewRequest — the moat
 * (completed job + paid invoice) is enforced server-side and never bypassed
 * here; its error is shown as-is. The pro then sends the link to the
 * customer themselves via SMS/WhatsApp — EveryJob never sends anything
 * automatically.
 */
export default function ReviewRequestCard({
  jobId,
  customerName,
  businessName,
  phone,
  regionCode,
  locale,
}: {
  jobId: string;
  customerName: string;
  businessName: string;
  phone: string | null | undefined;
  regionCode?: string | null;
  locale: Locale;
}) {
  const tr = (k: string) => t(locale, `jobops.reviewRequest.${k}`);
  // Set after mount so SSR and the first client render agree.
  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function run() {
    setStatus('working');
    setError('');
    const res = await createReviewRequest(jobId);
    if (!res.ok || !res.token) {
      setError(res.error ?? tr('failed'));
      setStatus('error');
      return;
    }
    setLink(`${origin}/rev/${res.token}`);
    setStatus('done');
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the link stays visible for manual copy.
    }
  }

  const message = link
    ? fill(tr('message'), { customerName, businessName, reviewLink: link })
    : '';

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
        <Star size={14} /> {tr('title')}
      </h2>

      {status === 'done' ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">{tr('linkReady')}</p>
          <p className="text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-700 w-full break-all select-all">
            {link}
          </p>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              {t(locale, 'jobops.notify.preview')}
            </p>
            <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
              {message}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border bg-zinc-500/10 border-zinc-500/30 text-zinc-700 hover:bg-zinc-500/20 min-h-[36px]"
            >
              {copied ? <Check size={13} /> : <Link2 size={13} />}
              {copied ? tr('copied') : tr('copy')}
            </button>
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
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">{tr('desc')}</p>
          <button
            type="button"
            onClick={run}
            disabled={status === 'working'}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 min-h-[44px]"
          >
            {status === 'working' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Star size={13} />
            )}
            {status === 'working' ? tr('creating') : tr('create')}
          </button>
          {status === 'error' && (
            <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
