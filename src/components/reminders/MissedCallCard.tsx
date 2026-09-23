'use client';

import React, { useState } from 'react';
import { AlertCircle, MessageCircle, PhoneMissed, Smartphone } from 'lucide-react';
import { draftMissedCall } from '@/app/actions/reminders';
import CopyButton from '@/components/CopyButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import { secondaryBtnClass, inputClass, Field } from '@/components/ui';
import { smsDraftLink } from '@/lib/reminders';
import type { ReminderUiStrings } from './ReminderRow';

/**
 * Missed-call text-back quick action.
 *
 * Honest by design: this is a MANUAL quick-draft. EveryJob has no phone /
 * telephony integration and does not detect missed calls — the owner picks
 * a customer and sends the text themselves from their own apps.
 */
export default function MissedCallCard({
  customers,
  regionCode,
  ui,
  title,
  note,
  pickCustomerLabel,
  draftLabel,
}: {
  customers: { id: string; name: string; phone: string }[];
  regionCode: string | null;
  ui: ReminderUiStrings;
  title: string;
  note: string;
  pickCustomerLabel: string;
  draftLabel: string;
}) {
  const [customerId, setCustomerId] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = customers.find((c) => c.id === customerId) ?? null;

  async function handleDraft(): Promise<void> {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await draftMissedCall(customerId);
      if (res.error) {
        setError(res.error);
        setText(null);
      } else if (res.text) {
        setText(res.text);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setText(null);
    }
    setLoading(false);
  }

  const smsHref = text && selected ? smsDraftLink(selected.phone, text) : '';

  return (
    <div className="bg-white rounded-2xl border border-smoke shadow-sm p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-xl bg-ink text-lime flex items-center justify-center shrink-0">
          <PhoneMissed size={16} />
        </span>
        <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
      </div>
      <p className="text-xs text-graphite mb-4">{note}</p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Field label={pickCustomerLabel}>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setText(null);
                setError(null);
              }}
              className={inputClass}
            >
              <option value="">{pickCustomerLabel}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void handleDraft()}
          disabled={loading || !customerId}
          className={`${secondaryBtnClass} shrink-0 disabled:opacity-50`}
        >
          <MessageCircle size={13} />
          {loading ? ui.preparing : draftLabel}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {text && selected && (
        <div className="mt-3 bg-ink rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <p className="text-[11px] font-bold uppercase tracking-wider text-lime">
              {ui.draftReady} — {selected.name}
            </p>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <WhatsAppButton
                phone={selected.phone}
                message={text}
                regionCode={regionCode}
                label={ui.whatsapp}
              />
              {smsHref && (
                <a
                  href={smsHref}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border bg-white border-smoke text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  <Smartphone size={13} />
                  {ui.sms}
                </a>
              )}
              <CopyButton text={text} label={ui.copy} />
            </div>
          </div>
          <p className="text-sm text-white/85 whitespace-pre-wrap">{text}</p>
          <p className="text-[11px] text-white/60 mt-2">{ui.neverSendsNote}</p>
        </div>
      )}
    </div>
  );
}
