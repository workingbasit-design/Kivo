'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { revokeSignRequest } from '@/app/actions/esign';

/**
 * Revoke one signing link after an explicit in-app confirmation (never the
 * native confirm() dialog, which is auto-dismissed in automated browsers and
 * some mobile webviews, making the button appear to do nothing).
 */
export default function RevokeSignButton({
  requestId,
  confirmText,
  revokeText,
  revokedText,
  cancelText,
}: {
  requestId: string;
  confirmText: string;
  revokeText: string;
  revokedText: string;
  cancelText: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function doRevoke() {
    setBusy(true);
    setError(null);
    const res = await revokeSignRequest(requestId);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setConfirming(false);
    setDone(true);
    router.refresh();
  }

  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={busy || done}
          className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60"
        >
          {busy ? '…' : done ? revokedText : revokeText}
        </button>
        {done && (
          <span className="text-[11px] font-semibold text-emerald-600">{revokedText}</span>
        )}
      </span>

      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={revokeText}
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-zinc-900">{revokeText}?</h3>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="text-zinc-400 hover:text-zinc-700 transition-colors"
                aria-label={cancelText}
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{confirmText}</p>
            {error && (
              <p className="mt-3 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">
                {error}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={doRevoke}
                disabled={busy}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
              >
                {busy ? '…' : revokeText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
