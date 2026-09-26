'use client';

import React, { useEffect, useState } from 'react';
import { Check, Link2, Loader2 } from 'lucide-react';
import { createReviewRequest } from '@/app/actions/review-requests';
import { cn } from '@/lib/utils';

/**
 * Generates a single-use review link for a job and copies it.
 * The pro then sends the link to the customer themselves (WhatsApp, SMS,
 * …) — EveryJob never sends anything automatically.
 */
export default function ReviewLinkButton({
  jobId,
  idleLabel,
  copiedLabel,
  errorLabel,
  className,
}: {
  jobId: string;
  idleLabel: string;
  copiedLabel: string;
  errorLabel: string;
  className?: string;
}) {
  // Set after mount so SSR and the first client render agree.
  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'copied' | 'error'>(
    'idle'
  );
  const [manualLink, setManualLink] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function run() {
    setStatus('working');
    setManualLink('');
    const res = await createReviewRequest(jobId);
    if (!res.ok || !res.token) {
      setStatus('error');
      return;
    }
    const url = `${origin}/rev/${res.token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (permissions, non-secure context) —
      // show the link for manual copy instead of failing silently.
      setManualLink(url);
    }
    setStatus('copied');
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={run}
        disabled={status === 'working'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border bg-amber-500/10 border-amber-500/30 text-amber-700 hover:bg-amber-500/20 disabled:opacity-60 min-h-[36px]"
      >
        {status === 'working' ? (
          <Loader2 size={13} className="animate-spin" />
        ) : status === 'copied' ? (
          <Check size={13} />
        ) : (
          <Link2 size={13} />
        )}
        {status === 'copied' ? copiedLabel : idleLabel}
      </button>
      {status === 'error' && (
        <p className="text-[11px] font-medium text-rose-600">{errorLabel}</p>
      )}
      {status === 'copied' && manualLink && (
        <input
          readOnly
          value={manualLink}
          onFocus={(e) => e.target.select()}
          className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-700 w-full"
        />
      )}
    </div>
  );
}
