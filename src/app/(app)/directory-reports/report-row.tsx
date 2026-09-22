'use client';

import { useState } from 'react';
import { updateReportStatus } from '@/app/actions/directory';

type Report = {
  id: string;
  businessName: string;
  reason: string;
  details: string | null;
  reporterContact: string | null;
  status: string;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  REVIEWED: 'bg-sky-50 text-sky-700 border-sky-200',
  DISMISSED: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export default function ReportRow({ report }: { report: Report }) {
  const [status, setStatus] = useState(report.status);
  const [busy, setBusy] = useState(false);

  async function set(next: 'REVIEWED' | 'DISMISSED') {
    setBusy(true);
    const res = await updateReportStatus(report.id, next);
    setBusy(false);
    if (res.ok) setStatus(next);
  }

  return (
    <div className="p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-zinc-900">{report.businessName}</p>
          <span
            className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? STATUS_STYLE.OPEN}`}
          >
            {status}
          </span>
        </div>
        <p className="text-xs text-zinc-600 mt-1">
          <span className="font-semibold">{report.reason}</span>
          {report.details && <span> — {report.details}</span>}
        </p>
        <p className="text-[11px] text-zinc-400 mt-1">
          {new Date(report.createdAt).toLocaleString()}
          {report.reporterContact && ` · reporter: ${report.reporterContact}`}
        </p>
      </div>
      {status === 'OPEN' && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => set('REVIEWED')}
            disabled={busy}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-60"
          >
            Mark reviewed
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
