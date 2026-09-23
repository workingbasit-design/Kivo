'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateReportStatus } from '@/app/actions/directory';
import { useResolvedT } from '@/hooks/useResolvedLocale';

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
  const { t } = useResolvedT();
  const [status, setStatus] = useState(report.status);
  const [busy, setBusy] = useState(false);

  const REASON_LABELS: Record<string, string> = {
    spam: t('t10misc.directory.reportReasonSpam'),
    'fake-listing': t('t10misc.directory.reportReasonFake'),
    'wrong-info': t('t10misc.directory.reportReasonWrongInfo'),
    'rude-behaviour': t('t10misc.directory.reportReasonRude'),
    other: t('t10misc.directory.reportReasonOther'),
  };

  async function setStatusTo(next: 'REVIEWED' | 'DISMISSED') {
    setBusy(true);
    try {
      const res = await updateReportStatus(report.id, next);
      if (res.ok) {
        setStatus(next);
        toast.success(
          t(next === 'REVIEWED' ? 't10misc.reports.reviewedToast' : 't10misc.reports.dismissedToast')
        );
      } else {
        toast.error(t('t10misc.misc.draftError'));
      }
    } catch {
      toast.error(t('t10misc.misc.draftError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-3">
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
            <span className="font-semibold">{REASON_LABELS[report.reason] ?? report.reason}</span>
            {report.details && <span> — {report.details}</span>}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {new Date(report.createdAt).toLocaleString()}
            {report.reporterContact && ` · ${t('t10misc.reports.reporter')}: ${report.reporterContact}`}
          </p>
        </div>
        {status === 'OPEN' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setStatusTo('REVIEWED')}
              disabled={busy}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-60"
            >
              <Check size={14} /> {busy ? '…' : t('t10misc.reports.markReviewed')}
            </button>
            <button
              onClick={() => setStatusTo('DISMISSED')}
              disabled={busy}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 disabled:opacity-60"
            >
              <X size={14} /> {t('t10misc.reports.dismiss')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
