'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Link2, RefreshCw, ShieldOff } from '@/components/icons';
import CopyButton from '@/components/CopyButton';
import { Button, DateField } from '@/components/kit';
import { t, type Locale } from '@/lib/i18n';
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
  locale = 'en',
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
  locale?: Locale;
}) {
  const S = (key: string) => t(locale, `share.${key}`);
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [tokenId, setTokenId] = useState<string | null>(initial?.id ?? null);
  const [expiresAt, setExpiresAt] = useState<string>(initial?.expiresAt ?? '');
  const [confirming, setConfirming] = useState<'regen' | 'revoke' | null>(null);

  // Wrap the injected server actions so token state updates on success in
  // the submission handler (user-initiated) instead of syncing via effects.
  const [regenState, regenFormAction, regenPending] = useActionState<RegenResult, FormData>(
    async (prev, formData) => {
      const result = await regenerateAction(prev, formData);
      if (result?.ok && result.token) {
        setToken(result.token);
        if (result.tokenId) setTokenId(result.tokenId);
        setExpiresAt('');
        setConfirming(null);
      }
      return result;
    },
    {}
  );
  const [revokeState, revokeFormAction, revokePending] = useActionState<ActionResult, FormData>(
    async (prev, formData) => {
      const result = await revokeAction(prev, formData);
      if (result?.ok) {
        setToken(null);
        setTokenId(null);
        setExpiresAt('');
        setConfirming(null);
      }
      return result;
    },
    {}
  );
  const [expiryState, expiryFormAction, expiryPending] = useActionState<ActionResult, FormData>(
    setExpiryAction,
    {}
  );

  // (Token-state sync now happens in the action wrappers above.)

  const error = regenState?.error || revokeState?.error || expiryState?.error;
  const okMsg =
    (regenState?.ok && S('created')) ||
    (revokeState?.ok && S('revoked')) ||
    (expiryState?.ok && S('expiryUpdated')) ||
    null;

  // 2026-11-09 deep test (F2): read the origin AFTER mount. A useState
  // lazy initializer runs on the client during hydration too, so it
  // produced a full URL on first client render while SSR rendered the
  // relative one — React #418 whenever a share link exists. Empty until
  // the mount effect sets it, so the first client render matches SSR.
  const [origin, setOrigin] = useState('');
  /* eslint-disable react-hooks/set-state-in-effect -- window.location
     can only be read client-side after hydration (the server-rendered
     markup must match first paint), so the origin is synced in this
     mount effect, not during render. */
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const url = token ? `${origin}/${kind === 'invoice' ? 'i' : 'q'}/${token}` : null;
  const field = kind === 'invoice' ? 'invoiceId' : 'quoteId';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
        <Link2 size={14} /> {S('title')}
      </h3>
      <p className="text-xs text-ink-2">
        {kind === 'invoice' ? S('viewInvoice') : S('viewQuote')}
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {okMsg && (
        <div className="bg-ok-bg border border-line text-ok text-xs font-medium rounded-xl px-3 py-2.5">
          {okMsg}
        </div>
      )}

      {url ? (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 break-all select-all text-ink">
              {url}
            </code>
            <CopyButton text={url} />
          </div>

          <form action={expiryFormAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tokenId" value={tokenId ?? ''} />
            <div className="flex-1 min-w-[160px]">
              <DateField
                label={S('expiresLabel')}
                name="expiresAt"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={expiryPending} className="mb-[18px]">
              <CalendarClock size={13} />
              {expiryPending ? S('saving') : expiresAt ? S('setExpiry') : S('clearExpiry')}
            </Button>
          </form>
          {expiresAt && (
            <p className="text-[11px] text-ink-2">
              {S('stopsAfter').replace('{date}', expiresAt)}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {confirming !== 'regen' ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming('regen')}
              >
                <RefreshCw size={13} /> {S('regenerate')}
              </Button>
            ) : (
              <form action={regenFormAction} className="flex items-center gap-2 bg-warn-bg border border-warn-line rounded-xl px-3 py-2">
                <input type="hidden" name={field} value={docId} />
                <span className="text-xs text-warn-text font-medium">{S('regenConfirm')}</span>
                <Button
                  type="submit"
                  variant="danger"
                  sm
                  disabled={regenPending}
                >
                  {regenPending ? S('working') : S('yesRegenerate')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  sm
                  onClick={() => setConfirming(null)}
                >
                  {S('keep')}
                </Button>
              </form>
            )}

            {confirming !== 'revoke' ? (
              <button
                type="button"
                onClick={() => setConfirming('revoke')}
                className="text-xs font-semibold text-danger hover:text-danger inline-flex items-center gap-1.5 px-2 py-2"
              >
                <ShieldOff size={13} /> {S('revoke')}
              </button>
            ) : (
              <form action={revokeFormAction} className="flex items-center gap-2 bg-danger-bg border border-line rounded-xl px-3 py-2">
                <input type="hidden" name={field} value={docId} />
                <span className="text-xs text-danger font-medium">{S('revokeConfirm')}</span>
                <Button
                  type="submit"
                  variant="danger"
                  sm
                  disabled={revokePending}
                >
                  {revokePending ? S('revoking') : S('yesRevoke')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  sm
                  onClick={() => setConfirming(null)}
                >
                  {S('keep')}
                </Button>
              </form>
            )}
          </div>
        </>
      ) : (
        <form action={regenFormAction}>
          <input type="hidden" name={field} value={docId} />
          <Button type="submit" variant="secondary" disabled={regenPending}>
            <Link2 size={13} />
            {regenPending ? S('creating') : S('createLink')}
          </Button>
        </form>
      )}
    </div>
  );
}
