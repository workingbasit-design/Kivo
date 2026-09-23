'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { approveDirectoryClaim, rejectDirectoryClaim } from '@/app/actions/directory-profile';
import { useResolvedT } from '@/hooks/useResolvedLocale';

type Claim = {
  id: string;
  status: string;
  note: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  slug: string | null;
  services: string[];
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export default function ClaimRow({ claim }: { claim: Claim }) {
  const { t } = useResolvedT();
  const [status, setStatus] = useState(claim.status);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const failed = t('t10misc.misc.draftError');

  async function approve() {
    setBusy(true);
    try {
      const res = await approveDirectoryClaim(claim.id);
      if (res.ok) {
        setStatus('APPROVED');
        toast.success(t('t10misc.claims.approvedToast'));
      } else {
        toast.error(failed);
      }
    } catch {
      toast.error(failed);
    } finally {
      setBusy(false);
    }
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('claimId', claim.id);
      fd.set('note', note);
      const res = await rejectDirectoryClaim({}, fd);
      if (res.ok) {
        setStatus('REJECTED');
        setRejecting(false);
        toast.success(t('t10misc.claims.rejectedToast'));
      } else {
        toast.error(failed);
      }
    } catch {
      toast.error(failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-zinc-900">{claim.businessName}</p>
            <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? STATUS_STYLE.PENDING}`}>
              {status}
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            {[claim.address, claim.phone].filter(Boolean).join(' · ') || t('t10misc.claims.noContact')}
          </p>
          {claim.services.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('t10misc.claims.services')}: {claim.services.join(', ')}
            </p>
          )}
          {claim.slug && (
            <Link
              href={`/p/${claim.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 min-h-[44px] text-[11px] font-bold text-ink hover:underline mt-0.5 px-1 -ml-1"
            >
              {t('t10misc.claims.previewProfile')} <ExternalLink size={11} />
            </Link>
          )}
          {claim.note && (
            <p className="text-xs text-zinc-500 mt-1 italic">
              {t('t10misc.claims.note')}: {claim.note}
            </p>
          )}
          <p className="text-[11px] text-zinc-400 mt-1">
            {t('t10misc.claims.requested')} {new Date(claim.createdAt).toLocaleString()}
            {claim.decidedBy ? ` · ${t('t10misc.claims.decidedBy')} ${claim.decidedBy}` : ''}
          </p>
        </div>
        {status === 'PENDING' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={approve}
              disabled={busy}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
            >
              <Check size={14} /> {busy ? '…' : t('t10misc.claims.approve')}
            </button>
            <button
              onClick={() => setRejecting((v) => !v)}
              disabled={busy}
              aria-expanded={rejecting}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 rounded-xl border border-zinc-300 hover:border-rose-400 text-zinc-600 hover:text-rose-600 disabled:opacity-60"
            >
              <X size={14} /> {t('t10misc.claims.reject')}
            </button>
          </div>
        )}
      </div>
      {rejecting && status === 'PENDING' && (
        <form onSubmit={reject} className="mt-3 flex flex-col sm:flex-row gap-2">
          <label htmlFor={`reject-note-${claim.id}`} className="sr-only">
            {t('t10misc.claims.reasonPlaceholder')}
          </label>
          <input
            id={`reject-note-${claim.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('t10misc.claims.reasonPlaceholder')}
            maxLength={500}
            className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-xs outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] text-xs font-bold px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
          >
            {busy ? '…' : t('t10misc.claims.confirmReject')}
          </button>
        </form>
      )}
    </div>
  );
}
