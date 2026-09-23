'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { inputClass, primaryBtnClass } from '@/components/ui';
import { createMilestoneInvoice } from '@/app/actions/batch-invoicing';

/**
 * Progress invoicing form: label + amount + optional description, creating
 * ONE invoice with milestoneLabel set, linked to this job. Rendered on the
 * job detail page.
 */
export default function MilestoneInvoiceForm({
  jobId,
  locale,
}: {
  jobId: string;
  locale: Locale;
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInvoiceId(null);
    start(async () => {
      const res = await createMilestoneInvoice(jobId, {
        label,
        amount,
        description,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setInvoiceId(res.invoiceId ?? null);
      setLabel('');
      setAmount('');
      setDescription('');
    });
  }

  return (
    <div className="mt-4 pt-4 border-t border-zinc-100">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {invoiceId && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 mb-4">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <span>
            {t(locale, 'billing.milestoneCreated')}{' '}
            <Link
              href={`/invoices/${invoiceId}`}
              className="font-semibold underline"
            >
              {t(locale, 'billing.viewInvoices')}
            </Link>
          </span>
        </div>
      )}
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'billing.labelLabel')}
          </label>
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t(locale, 'billing.labelPlaceholder')}
            maxLength={80}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'billing.amountLabel')}
          </label>
          <input
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t(locale, 'billing.amountPlaceholder')}
            inputMode="decimal"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'billing.descriptionLabel')}
          </label>
          <textarea
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(locale, 'billing.descriptionPlaceholder')}
            rows={2}
            maxLength={2000}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            {busy ? t(locale, 'billing.creating') : t(locale, 'billing.createMilestone')}
          </button>
        </div>
      </form>
    </div>
  );
}
