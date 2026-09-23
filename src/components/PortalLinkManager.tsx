'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { AlertCircle, Link2, MessageCircle, RefreshCw, ShieldOff } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { secondaryBtnClass } from '@/components/ui';
import {
  createPortalLink,
  revokePortalLink,
  type PortalActionResult,
} from '@/app/actions/portal';

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
}: {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  businessName: string;
  regionCode?: string | null;
  initialTokenId: string | null;
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

  // Set after mount so SSR and the first client render agree.
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = token ? `${origin}/portal/${token}` : null;

  const error = regenState?.error || revokeState?.error;
  const okMsg =
    (regenState?.ok && 'Portal link created — share it with the customer.') ||
    (revokeState?.ok && 'Portal link revoked.') ||
    null;

  if (!customerPhone) {
    return (
      <p className="text-xs text-zinc-500">
        Add a phone number for this customer to share their portal link over WhatsApp.
      </p>
    );
  }

  const digits = customerPhone.replace(/\D/g, '');
  const cc = '1'; // Canada-only (NANP)
  const waDigits = digits.length === 10 && !digits.startsWith(cc) ? cc + digits : digits;
  const waMessage =
    `Hi ${customerName}! View your jobs, quotes, invoices and balance with ${businessName} here: ${url ?? ''}` +
    `\n\n— sent via EveryJob`;
  const waHref = url ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}` : '';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
        <Link2 size={14} /> Customer portal link
      </h3>
      <p className="text-xs text-zinc-500">
        A private magic link where {customerName} can see their jobs, quotes, invoices and
        balance. Share it over WhatsApp — the customer taps the button and sends it
        from their own WhatsApp app.
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
          <div className="flex flex-wrap gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border bg-[#25D366]/10 border-[#25D366]/30 text-[#128C4A] hover:bg-[#25D366]/20"
              title="Opens WhatsApp with the portal invite prefilled"
            >
              <MessageCircle size={13} /> Share portal link on WhatsApp
            </a>
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
                <input type="hidden" name="tokenId" value={tokenId ?? ''} />
                <input type="hidden" name="customerId" value={customerId} />
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
          <input type="hidden" name="customerId" value={customerId} />
          {tokenId && confirming !== 'regen' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-500">A portal link is already active for this customer.</p>
              <button
                type="button"
                onClick={() => setConfirming('regen')}
                className={secondaryBtnClass}
              >
                <RefreshCw size={13} /> Regenerate
              </button>
            </div>
          ) : confirming === 'regen' ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
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
            </div>
          ) : (
            <button type="submit" disabled={regenPending} className={secondaryBtnClass}>
              <Link2 size={13} />
              {regenPending ? 'Creating…' : 'Create portal link'}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
