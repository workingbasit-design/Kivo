'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Link2, MessageCircle, RefreshCw, ShieldOff } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import CopyButton from '@/components/CopyButton';
import { Button } from '@/components/kit';
import {
  createPortalLink,
  revokePortalLink,
  type PortalActionResult,
} from '@/app/actions/portal';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

type RegenResult = PortalActionResult;

/**
 * Customer portal link manager (customer detail page).
 *
 * Generates a magic-link portal URL for the customer and a wa.me deep link
 * with the invite prefilled - the business owner taps it and sends from
 * their own WhatsApp app. EveryJob never sends anything automatically.
 * Renders nothing useful without a customer phone number.
 */
export default function PortalLinkManager({
  customerId,
  customerName,
  customerPhone,
  businessName,
  regionCode,
  initialTokenId,
  locale = 'en',
}: {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  businessName: string;
  regionCode?: string | null;
  initialTokenId: string | null;
  locale?: Locale;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(initialTokenId);
  const [confirming, setConfirming] = useState<'regen' | 'revoke' | null>(null);

  // Wrap the server actions so token state updates on success right in the
  // submission handler (user-initiated) instead of syncing via effects.
  const [regenState, regenFormAction, regenPending] = useActionState<RegenResult, FormData>(
    async (prev, formData) => {
      const result = await createPortalLink(prev, formData);
      if (result?.ok && result.token) {
        setToken(result.token);
        setTokenId(result.tokenId ?? null);
        setConfirming(null);
      }
      return result;
    },
    {}
  );
  const [revokeState, revokeFormAction, revokePending] = useActionState<PortalActionResult, FormData>(
    async (prev, formData) => {
      const result = await revokePortalLink(prev, formData);
      if (result?.ok) {
        setToken(null);
        setTokenId(null);
        setConfirming(null);
      }
      return result;
    },
    {}
  );

  // (Token-state sync now happens in the action wrappers above.)

  useResultToast(regenState, {
    success: t(locale, 't10money.portalLinkCreated'),
  });
  useResultToast(revokeState, {
    success: t(locale, 't10money.portalLinkRevoked'),
  });

  // Read after mount so SSR and the first client render agree (avoids
  // hydration mismatch): lazy initializer runs on the client only.
  const [origin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin
  );
  const url = token ? `${origin}/portal/${token}` : null;

  const error = regenState?.error || revokeState?.error;

  if (!customerPhone) {
    return (
      <p className="text-xs text-ink-2">
        {t(locale, 't10money.portalMgrNoPhone')}
      </p>
    );
  }

  const digits = customerPhone.replace(/\D/g, '');
  const cc = '1'; // Canada-only (NANP)
  const waDigits = digits.length === 10 && !digits.startsWith(cc) ? cc + digits : digits;
  const waMessage = t(locale, 't10money.portalMgrWaMessage')
    .replace('{name}', customerName)
    .replace('{business}', businessName)
    .replace('{url}', url ?? '');
  const waHref = url ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}` : '';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
        <Link2 size={14} /> {t(locale, 't10money.portalMgrTitle')}
      </h3>
      <p className="text-xs text-ink-2">
        {t(locale, 't10money.portalMgrDesc').replace('{name}', customerName)}
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-danger/25 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {url ? (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 break-all select-all text-ink">
              {url}
            </code>
            <CopyButton text={url} />
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors border bg-wa/10 border-wa/30 text-wa-deep hover:bg-wa/20"
              title={t(locale, 't10money.portalMgrWaTitle')}
            >
              <MessageCircle size={13} /> {t(locale, 't10money.portalMgrWaShare')}
            </a>
            {confirming !== 'revoke' ? (
              <Button
                variant="ghost"
                sm
                onClick={() => setConfirming('revoke')}
                className="text-danger"
              >
                <ShieldOff size={13} /> {t(locale, 't10money.portalMgrRevoke')}
              </Button>
            ) : (
              <form action={revokeFormAction} className="flex flex-wrap items-center gap-2 bg-danger-bg border border-danger/25 rounded-xl px-3 py-2">
                <input type="hidden" name="tokenId" value={tokenId ?? ''} />
                <input type="hidden" name="customerId" value={customerId} />
                <span className="text-xs text-danger font-medium">{t(locale, 't10money.portalMgrRevokeConfirm')}</span>
                <Button
                  variant="danger"
                  sm
                  type="submit"
                  disabled={revokePending}
                  className="disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {revokePending ? t(locale, 't10money.portalMgrRevoking') : t(locale, 't10money.portalMgrYesRevoke')}
                </Button>
                <Button
                  variant="ghost"
                  sm
                  onClick={() => setConfirming(null)}
                  className="hover:text-ink"
                >
                  {t(locale, 't10money.portalMgrKeep')}
                </Button>
              </form>
            )}
          </div>
        </>
      ) : (
        <form action={regenFormAction}>
          <input type="hidden" name="customerId" value={customerId} />
          {tokenId && confirming !== 'regen' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-ink-2">{t(locale, 't10money.portalMgrActive')}</p>
              <Button
                variant="secondary"
                sm
                onClick={() => setConfirming('regen')}
              >
                <RefreshCw size={13} /> {t(locale, 't10money.portalMgrRegenerate')}
              </Button>
            </div>
          ) : confirming === 'regen' ? (
            <div className="flex flex-wrap items-center gap-2 bg-warn-bg border border-warn-line rounded-xl px-3 py-2">
              <span className="text-xs text-warn-text font-medium">{t(locale, 't10money.portalMgrRegenConfirm')}</span>
              <Button
                variant="secondary"
                sm
                type="submit"
                disabled={regenPending}
                className="disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {regenPending ? t(locale, 't10money.portalMgrWorking') : t(locale, 't10money.portalMgrYesRegen')}
              </Button>
              <Button
                variant="ghost"
                sm
                onClick={() => setConfirming(null)}
                className="hover:text-ink"
              >
                {t(locale, 't10money.portalMgrKeep')}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              type="submit"
              disabled={regenPending}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Link2 size={13} />
              {regenPending ? t(locale, 't10money.portalMgrCreating') : t(locale, 't10money.portalMgrCreate')}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
