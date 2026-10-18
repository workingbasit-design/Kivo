'use client';

import React, { useState } from 'react';
import { Check, Link2, Loader2, Star } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card } from '@/components/kit';
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
 * server-moated single-use review link via createReviewRequest - the moat
 * (completed job + paid invoice) is enforced server-side and never bypassed
 * here; its error is shown as-is. The pro then sends the link to the
 * customer themselves via SMS/WhatsApp - EveryJob never sends anything
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
  // Read after mount so SSR and the first client render agree (avoids
  // hydration mismatch): lazy initializer runs on the client only.
  const [origin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin
  );
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

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
      // Clipboard unavailable - the link stays visible for manual copy.
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
          <p className="text-xs text-ink-2">{tr('linkReady')}</p>
          <p className="text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 text-ink w-full break-all select-all">
            {link}
          </p>
          <div>
            <p className="text-[11px] font-bold text-ink-2 mb-1.5">
              {t(locale, 'jobops.notify.preview')}
            </p>
            <p className="text-sm text-ink bg-surface-2 border border-line rounded-xl px-3 py-2.5 whitespace-pre-wrap">
              {message}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              sm
              onClick={copyLink}
            >
              {copied ? <Check size={13} /> : <Link2 size={13} />}
              {copied ? tr('copied') : tr('copy')}
            </Button>
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
          <p className="text-xs text-ink-2">{tr('desc')}</p>
          <Button
            type="button"
            variant="primary"
            sm
            onClick={run}
            disabled={status === 'working'}
          >
            {status === 'working' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Star size={13} />
            )}
            {status === 'working' ? tr('creating') : tr('create')}
          </Button>
          {status === 'error' && (
            <p className="text-xs font-medium text-danger bg-danger-bg border border-line rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
