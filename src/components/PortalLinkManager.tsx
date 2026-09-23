'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Link2, MessageCircle, RefreshCw, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import CopyButton from '@/components/CopyButton';
import { secondaryBtnClass } from '@/components/ui';
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
 * with the invite prefilled — the business owner taps it and sends from
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

  const [regenState, regenFormAction, regenPending] = useActionState<RegenResult, FormData>(
    createPortalLink,
    {}
  );
  const [revokeState, revokeFormAction, revokePending] = useActionState<PortalActionResult, FormData>(
    revokePortalLink,
    {}
  );

  useEffect(() => {
    if (regenState?.ok && regenState.token) {
      setToken(regenState.token);
      setTokenId(regenState.tokenId ?? null);
      setConfirming(null);
    }
  }, [regenState]);
  useEffect(() => {
    if (revokeState?.ok) {
      setToken(null);
      setTokenId(null);
      setConfirming(null);
    }
  }, [revokeState]);

  useResultToast(regenState, {
    success: t(locale, 't10money.portalLinkCreated'),
  });
  useResultToast(revokeState, {
    success: t(locale, 't10money.portalLinkRevoked'),
  });

  // Set after mount so SSR and the first client render agree.
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = token ? `${origin}/portal/${token}` : null;

  const error = regenState?.error || revokeState?.error;

  if (!customerPhone) {
    return (
      <p className="text-xs text-zinc-500">
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
      <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
        <Link2 size={14} /> {t(locale, 't10money.portalMgrTitle')}
      </h3>
      <p className="text-xs text-zinc-500">
        {t(locale, 't10money.portalMgrDesc').replace('{name}', customerName)}
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {url ? (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 truncate text-zinc-700">
              {url}
            </code>
            <CopyButton text={url} />
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors border bg-[#25D366]/10 border-[#25D366]/30 text-[#128C4A] hover:bg-[#25D366]/20"
              title={t(locale, 't10money.portalMgrWaTitle')}
            >
              <MessageCircle size={13} /> {t(locale, 't10money.portalMgrWaShare')}
            </a>
            {confirming !== 'revoke' ? (
              <button
                type="button"
                onClick={() => setConfirming('revoke')}
                className="min-h-[44px] text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5 px-2"
              >
                <ShieldOff size={13} /> {t(locale, 't10money.portalMgrRevoke')}
              </button>
            ) : (
              <form action={revokeFormAction} className="flex flex-wrap items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                <input type="hidden" name="tokenId" value={tokenId ?? ''} />
                <input type="hidden" name="customerId" value={customerId} />
                <span className="text-xs text-rose-700 font-medium">{t(locale, 't10money.portalMgrRevokeConfirm')}</span>
                <button
                  type="submit"
                  disabled={revokePending}
                  className="min-h-[44px] text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-4 rounded-lg transition-colors"
                >
                  {revokePending ? t(locale, 't10money.portalMgrRevoking') : t(locale, 't10money.portalMgrYesRevoke')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="min-h-[44px] text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-3"
                >
                  {t(locale, 't10money.portalMgrKeep')}
                </button>
              </form>
            )}
          </div>
        </>
      ) : (
        <form action={regenFormAction}>
          <input type="hidden" name="customerId" value={customerId} />
          {tokenId && confirming !== 'regen' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-500">{t(locale, 't10money.portalMgrActive')}</p>
              <button
                type="button"
                onClick={() => setConfirming('regen')}
                className={secondaryBtnClass}
              >
                <RefreshCw size={13} /> {t(locale, 't10money.portalMgrRegenerate')}
              </button>
            </div>
          ) : confirming === 'regen' ? (
            <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="text-xs text-amber-800 font-medium">{t(locale, 't10money.portalMgrRegenConfirm')}</span>
              <button
                type="submit"
                disabled={regenPending}
                className="min-h-[44px] text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-4 rounded-lg transition-colors"
              >
                {regenPending ? t(locale, 't10money.portalMgrWorking') : t(locale, 't10money.portalMgrYesRegen')}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="min-h-[44px] text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-3"
              >
                {t(locale, 't10money.portalMgrKeep')}
              </button>
            </div>
          ) : (
            <button type="submit" disabled={regenPending} className={secondaryBtnClass}>
              <Link2 size={13} />
              {regenPending ? t(locale, 't10money.portalMgrCreating') : t(locale, 't10money.portalMgrCreate')}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
