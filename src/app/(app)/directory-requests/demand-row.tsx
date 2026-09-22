'use client';

import { useState } from 'react';
import { updateDirectoryRequestStatus } from '@/app/actions/directory';

type DemandRequest = {
  id: string;
  serviceNeed: string;
  city: string;
  area: string | null;
  name: string;
  phone: string;
  details: string | null;
  status: string;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISMISSED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export default function DemandRow({ request }: { request: DemandRequest }) {
  const [status, setStatus] = useState(request.status);
  const [busy, setBusy] = useState(false);

  async function set(next: 'FULFILLED' | 'DISMISSED') {
    setBusy(true);
    const res = await updateDirectoryRequestStatus(request.id, next);
    setBusy(false);
    if (res.ok) setStatus(next);
  }

  return (
    <div className="p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-zinc-900">{request.serviceNeed}</p>
          <span
            className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? STATUS_STYLE.OPEN}`}
          >
            {status}
          </span>
        </div>
        <p className="text-xs text-zinc-600 mt-1">
          {request.city}
          {request.area ? ` (${request.area})` : ''}
          {' · '}
          {request.name} · {request.phone}
        </p>
        {request.details && (
          <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{request.details}</p>
        )}
        <p className="text-[11px] text-zinc-400 mt-1">
          {new Date(request.createdAt).toLocaleString()}
        </p>
      </div>
      {status === 'OPEN' && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => set('FULFILLED')}
            disabled={busy}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
          >
            Mark fulfilled
          </button>
          <button
            onClick={() => set('DISMISSED')}
            disabled={busy}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
