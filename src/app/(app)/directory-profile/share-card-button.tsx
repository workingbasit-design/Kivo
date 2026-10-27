'use client';

import { useState } from 'react';
import { Share2 } from '@/components/icons';

/**
 * Scroll lesson 3 — share the pro card through the OS share sheet when
 * the device offers one, falling back to copying the card text + link.
 * Dismissing the sheet is not an error; only a real share/copy failure
 * shows the link for manual copying.
 */
export default function ShareCardButton({
  title,
  text,
  path,
  shareLabel,
  copiedLabel,
  copyManuallyLabel,
}: {
  title: string;
  text: string;
  /** Public profile path, e.g. "/p/lion-calulator". Made absolute at click time. */
  path: string;
  shareLabel: string;
  copiedLabel: string;
  copyManuallyLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const onShare = async () => {
    const url = `${window.location.origin}${path}`;
    setManualUrl(null);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
      throw new Error('share-unavailable');
    } catch (err) {
      // The user closing the sheet is a no-op, not a failure.
      if (err instanceof Error && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 3000);
      } catch {
        setManualUrl(url);
      }
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onShare}
        className="min-h-[44px] inline-flex items-center gap-2 bg-hivis hover:opacity-90 text-asphalt px-4 py-2.5 rounded-xl font-bold text-xs"
      >
        <Share2 size={16} />
        {shareLabel}
      </button>
      {copied && (
        <p role="status" className="text-xs text-ok font-bold mt-2">
          {copiedLabel}
        </p>
      )}
      {manualUrl && (
        <p className="text-xs text-ink-2 mt-2 break-all">
          {copyManuallyLabel} {manualUrl}
        </p>
      )}
    </div>
  );
}
