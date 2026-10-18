'use client';

import React, { useState } from 'react';
import { AlertCircle, MessageCircle } from '@/components/icons';
import { draftPaymentReminder } from '@/app/actions/marketing';
import CopyButton from '@/components/CopyButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Button } from '@/components/kit';

/**
 * Generates a polite, copy-paste payment reminder draft.
 * Never sends anything - the business copies the draft or taps the
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
      <Button
        type="button"
        variant="secondary"
        onClick={handleDraft}
        disabled={loading}
      >
        <MessageCircle size={13} />
        {loading ? 'Drafting…' : text ? 'Re-draft reminder' : 'Draft reminder'}
      </Button>

      {error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {text && (
        <div className="bg-warn-bg border border-warn-line rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold text-warn-text">
              Reminder draft - send it yourself
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <WhatsAppButton phone={phone} message={text} regionCode={regionCode} />
              <CopyButton text={text} label="Copy" />
            </div>
          </div>
          <p className="text-sm text-ink whitespace-pre-wrap">{text}</p>
          <p className="text-[11px] text-warn-text/70 mt-2">
            EveryJob never sends messages itself - tap the WhatsApp button or copy this
            and send it via WhatsApp or SMS.
          </p>
        </div>
      )}
    </div>
  );
}
