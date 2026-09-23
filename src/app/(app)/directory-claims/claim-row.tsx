'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { approveDirectoryClaim, rejectDirectoryClaim } from '@/app/actions/directory-profile';

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
  const [status, setStatus] = useState(claim.status);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  async function approve() {
    setBusy(true);
    const res = await approveDirectoryClaim(claim.id);
    setBusy(false);
    if (res.ok) setStatus('APPROVED');
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.set('claimId', claim.id);
    fd.set('note', note);
    const res = await rejectDirectoryClaim({}, fd);
    setBusy(false);
    if (res.ok) {
      setStatus('REJECTED');
      setRejecting(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-zinc-900">{claim.businessName}</p>
            <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? STATUS_STYLE.PENDING}`}>
              {status}
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            {[claim.address, claim.phone].filter(Boolean).join(' · ') || 'No address/phone on file'}
          </p>
          {claim.services.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">Services: {claim.services.join(', ')}</p>
          )}
          {claim.slug && (
            <Link href={`/p/${claim.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[11px] font-bold text-ink hover:underline mt-1">
              Preview public profile <ExternalLink size={11} />
            </Link>
          )}
          {claim.note && <p className="text-xs text-zinc-500 mt-1 italic">Note: {claim.note}</p>}
          <p className="text-[11px] text-zinc-400 mt-1">
            Requested {new Date(claim.createdAt).toLocaleString()}
            {claim.decidedBy ? ` · decided by ${claim.decidedBy}` : ''}
          </p>
        </div>
        {status === 'PENDING' && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={approve}
              disabled={busy}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
            >
              {busy ? '…' : 'Approve'}
            </button>
            <button
              onClick={() => setRejecting((v) => !v)}
              disabled={busy}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-300 hover:border-rose-400 text-zinc-600 hover:text-rose-600 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        )}
      </div>
      {rejecting && status === 'PENDING' && (
        <form onSubmit={reject} className="mt-3 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (shown to the business)…"
            maxLength={500}
            className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-xs outline-none focus:border-zinc-500"
          />
          <button type="submit" disabled={busy} className="text-xs font-bold px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60">
            Confirm reject
          </button>
        </form>
      )}
    </div>
  );
}
