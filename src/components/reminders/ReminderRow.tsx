'use client';

import React, { useState } from 'react';
import { AlertCircle, MessageCircle, Mail, Smartphone } from 'lucide-react';
import { draftJobReminder, draftInvoiceFollowup, type DraftResult } from '@/app/actions/reminders';
import CopyButton from '@/components/CopyButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import { secondaryBtnClass } from '@/components/ui';
import { smsDraftLink, mailtoDraftLink } from '@/lib/reminders';

/**
 * One reminder queue row: summary + "Prepare reminder" expander + one-tap
 * draft buttons. EveryJob never sends anything — the owner taps a button
 * and sends from their own WhatsApp / SMS / email app.
 */
export interface ReminderUiStrings {
  prepareReminder: string;
  preparing: string;
  redraft: string;
  draftReady: string;
  neverSendsNote: string;
  whatsapp: string;
  sms: string;
  email: string;
  copy: string;
}

const sendBtnClass =
  'inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-xs font-semibold transition-colors border bg-white border-smoke text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900';

export default function ReminderRow({
  kind,
  recordId,
  phone,
  email,
  emailSubject,
  regionCode,
  ui,
  children,
}: {
  kind: 'job' | 'invoice';
  recordId: string;
  phone: string | null;
  email: string | null;
  emailSubject: string;
  regionCode: string | null;
  ui: ReminderUiStrings;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDraft(): Promise<void> {
    setLoading(true);
    setError(null);
    let res: DraftResult;
    try {
      res = kind === 'job' ? await draftJobReminder(recordId) : await draftInvoiceFollowup(recordId);
    } catch {
      res = { error: 'Something went wrong. Please try again.' };
    }
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setText(null);
    } else if (res.text) {
      setText(res.text);
    }
  }

  const smsHref = text ? smsDraftLink(phone, text) : '';
  const mailHref = text ? mailtoDraftLink(email, emailSubject, text) : '';

  return (
    <div className="bg-white rounded-2xl border border-smoke shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open && !text && !loading) void handleDraft();
          }}
          className={`${secondaryBtnClass} shrink-0`}
          aria-expanded={open}
        >
          <MessageCircle size={13} />
          {loading ? ui.preparing : text ? ui.redraft : ui.prepareReminder}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {text && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  {ui.draftReady}
                </p>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <WhatsAppButton
                    phone={phone}
                    message={text}
                    regionCode={regionCode}
                    label={ui.whatsapp}
                  />
                  {smsHref && (
                    <a href={smsHref} className={sendBtnClass} title={ui.sms}>
                      <Smartphone size={13} />
                      {ui.sms}
                    </a>
                  )}
                  {mailHref && (
                    <a href={mailHref} className={sendBtnClass} title={ui.email}>
                      <Mail size={13} />
                      {ui.email}
                    </a>
                  )}
                  <CopyButton text={text} label={ui.copy} />
                </div>
              </div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{text}</p>
              <p className="text-[11px] text-amber-700/70 mt-2">{ui.neverSendsNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
