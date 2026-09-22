'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Link2, RefreshCw, ShieldOff } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { inputClass, secondaryBtnClass } from '@/components/ui';
import type { ActionResult } from '@/app/actions/invoices';

type ShareState = {
  id: string;
  token: string;
  expiresAt: string | null;
} | null;

type RegenResult = ActionResult & { token?: string; tokenId?: string };

/**
 * Share-link manager for quote/invoice detail pages: shows the public URL,
 * copy, regenerate (invalidates the old token), revoke, and an optional
 * expiry date. Server actions are injected so one component serves both.
 */
export default function ShareTokenManager({
  kind,
  docId,
  initial,
  regenerateAction,
  revokeAction,
  setExpiryAction,
}: {
  kind: 'invoice' | 'quote';
  docId: string;
  initial: ShareState;
  regenerateAction: (
    prev: RegenResult,
    formData: FormData
  ) => Promise<RegenResult>;
  revokeAction: (
    prev: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;
  setExpiryAction: (
    prev: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;
}) {
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [tokenId, setTokenId] = useState<string | null>(initial?.id ?? null);
  const [expiresAt, setExpiresAt] = useState<string>(initial?.expiresAt ?? '');
  const [confirming, setConfirming] = useState<'regen' | 'revoke' | null>(null);

  const [regenState, regenFormAction, regenPending] = useActionState<RegenResult, FormData>(
    regenerateAction,
    {}
  );
  const [revokeState, revokeFormAction, revokePending] = useActionState<ActionResult, FormData>(
    revokeAction,
    {}
  );
  const [expiryState, expiryFormAction, expiryPending] = useActionState<ActionResult, FormData>(
    setExpiryAction,
    {}
  );

  // Pick up fresh results from the server actions.
  useEffect(() => {
    if (regenState?.ok && regenState.token) {
      setToken(regenState.token);
      if (regenState.tokenId) setTokenId(regenState.tokenId);
      setExpiresAt('');
      setConfirming(null);
    }
  }, [regenState]);
  useEffect(() => {
    if (revokeState?.ok) {
      setToken(null);
      setTokenId(null);
      setExpiresAt('');
      setConfirming(null);
    }
  }, [revokeState]);
  useEffect(() => {
    if (expiryState?.ok) {
      // expiry saved — the displayed value is already what the user picked
    }
  }, [expiryState]);

  const error = regenState?.error || revokeState?.error || expiryState?.error;
  const okMsg =
    (regenState?.ok && 'New share link created — the old one no longer works.') ||
    (revokeState?.ok && 'Share link revoked.') ||
    (expiryState?.ok && 'Expiry updated.') ||
    null;

  // Set after mount so SSR and the first client render agree (avoids hydration mismatch).
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = token ? `${origin}/${kind === 'invoice' ? 'i' : 'q'}/${token}` : null;
  const field = kind === 'invoice' ? 'invoiceId' : 'quoteId';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
        <Link2 size={14} /> Public share link
      </h3>
      <p className="text-xs text-zinc-500">
        Anyone with this link can view the {kind}. Revoke it anytime to cut off access.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {okMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
          {okMsg}
        </div>
      )}

      {url ? (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 truncate text-zinc-700">
              {url}
            </code>
            <CopyButton text={url} />
          </div>

          <form action={expiryFormAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tokenId" value={tokenId ?? ''} />
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                Link expires (optional)
              </label>
              <input
                type="date"
                name="expiresAt"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={expiryPending} className={secondaryBtnClass}>
              <CalendarClock size={13} />
              {expiryPending ? 'Saving…' : expiresAt ? 'Set expiry' : 'Clear expiry'}
            </button>
          </form>
          {expiresAt && (
            <p className="text-[11px] text-zinc-400">
              This link stops working after {expiresAt}.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {confirming !== 'regen' ? (
              <button
                type="button"
                onClick={() => setConfirming('regen')}
                className={secondaryBtnClass}
              >
                <RefreshCw size={13} /> Regenerate link
              </button>
            ) : (
              <form action={regenFormAction} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <input type="hidden" name={field} value={docId} />
                <span className="text-xs text-amber-800 font-medium">Old link stops working. Continue?</span>
                <button
                  type="submit"
                  disabled={regenPending}
                  className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {regenPending ? 'Working…' : 'Yes, regenerate'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-2 py-1.5"
                >
                  Keep
                </button>
              </form>
            )}

            {confirming !== 'revoke' ? (
              <button
                type="button"
                onClick={() => setConfirming('revoke')}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5 px-2 py-2"
              >
                <ShieldOff size={13} /> Revoke link
              </button>
            ) : (
              <form action={revokeFormAction} className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                <input type="hidden" name={field} value={docId} />
                <span className="text-xs text-rose-700 font-medium">Revoke this link?</span>
                <button
                  type="submit"
                  disabled={revokePending}
                  className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {revokePending ? 'Revoking…' : 'Yes, revoke'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-2 py-1.5"
                >
                  Keep
                </button>
              </form>
            )}
          </div>
        </>
      ) : (
        <form action={regenFormAction}>
          <input type="hidden" name={field} value={docId} />
          <button type="submit" disabled={regenPending} className={secondaryBtnClass}>
            <Link2 size={13} />
            {regenPending ? 'Creating…' : 'Create share link'}
          </button>
        </form>
      )}
    </div>
  );
}
