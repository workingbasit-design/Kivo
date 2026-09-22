'use client';

import React, { useState } from 'react';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { draftPaymentReminder } from '@/app/actions/marketing';
import CopyButton from '@/components/CopyButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import { secondaryBtnClass } from '@/components/ui';

/**
 * Generates a polite, copy-paste payment reminder draft.
 * Never sends anything — the business copies the draft or taps the
 * WhatsApp button to send it themselves from their own WhatsApp.
 */
export default function ReminderDraft({
  invoiceId,
  phone,
  regionCode,
}: {
  invoiceId: string;
  phone?: string | null;
  regionCode?: string | null;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDraft() {
    setLoading(true);
    setError(null);
    const res = await draftPaymentReminder(invoiceId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setText(null);
    } else if (res.text) {
      setText(res.text);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleDraft}
        disabled={loading}
        className={secondaryBtnClass}
      >
        <MessageCircle size={13} />
        {loading ? 'Drafting…' : text ? 'Re-draft reminder' : 'Draft reminder'}
      </button>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {text && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Reminder draft — send it yourself
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <WhatsAppButton phone={phone} message={text} regionCode={regionCode} />
              <CopyButton text={text} label="Copy" />
            </div>
          </div>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{text}</p>
          <p className="text-[11px] text-amber-700/70 mt-2">
            Kivo never sends messages itself — tap the WhatsApp button or copy this
            and send it via WhatsApp or SMS.
          </p>
        </div>
      )}
    </div>
  );
}
