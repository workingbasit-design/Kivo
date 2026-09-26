'use client';

import React, { useState } from 'react';
import { Check, Copy, Link2, PenLine, CalendarDays, Type } from 'lucide-react';
import { createSignRequest } from '@/app/actions/esign';
import type { SignField } from '@/lib/esign';
import { primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { cn } from '@/lib/utils';
import WhatsAppButton from '@/components/WhatsAppButton';

type FieldType = 'signature' | 'date' | 'initials';

type Strings = {
  fieldSignature: string;
  fieldDate: string;
  fieldInitials: string;
  sendLink: string;
  phone: string;
  remove: string;
  shareTitle: string;
  shareHint: string;
  copyLink: string;
  copied: string;
  legalLine: string;
};

const FIELD_DEFS: { type: FieldType; icon: React.ReactNode; labelKey: keyof Strings }[] = [
  { type: 'signature', icon: <PenLine size={14} />, labelKey: 'fieldSignature' },
  { type: 'date', icon: <CalendarDays size={14} />, labelKey: 'fieldDate' },
  { type: 'initials', icon: <Type size={14} />, labelKey: 'fieldInitials' },
];

const FIELD_LETTER: Record<FieldType, string> = {
  signature: 'S',
  date: 'D',
  initials: 'I',
};

export default function SignPrepareClient({
  quoteId,
  quoteNumber,
  quoteTitle,
  customerName,
  customerPhone,
  regionCode,
  strings: s,
  children,
}: {
  quoteId: string;
  quoteNumber: string;
  quoteTitle: string;
  customerName: string;
  customerPhone: string | null;
  regionCode: string | null;
  strings: Strings;
  children: React.ReactNode;
}) {
  const [activeType, setActiveType] = useState<FieldType>('signature');
  const [fields, setFields] = useState<SignField[]>([]);
  const [contact, setContact] = useState(customerPhone ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function placeField(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFields((f) => [
      ...f,
      {
        type: activeType,
        x: Math.min(100, Math.max(0, x)),
        y: Math.min(100, Math.max(0, y)),
        page: 0,
      },
    ]);
  }

  function removeField(index: number) {
    setFields((f) => f.filter((_, i) => i !== index));
  }

  async function send() {
    if (fields.length === 0 || sending) return;
    setSending(true);
    setError(null);
    const res = await createSignRequest(
      quoteId,
      fields,
      contact.trim() ? contact.trim() : null
    );
    setSending(false);
    if (res.ok && res.token) {
      setToken(res.token);
    } else {
      setError(res.error ?? 'Error');
    }
  }

  if (token) {
    return (
      <SignShareSheet
        token={token}
        quoteNumber={quoteNumber}
        quoteTitle={quoteTitle}
        customerName={customerName}
        customerPhone={customerPhone}
        regionCode={regionCode}
        s={s}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Field palette */}
      <div className="flex flex-wrap gap-2">
        {FIELD_DEFS.map((d) => (
          <button
            key={d.type}
            type="button"
            onClick={() => setActiveType(d.type)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors',
              activeType === d.type
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
            )}
          >
            {d.icon} {s[d.labelKey]}
          </button>
        ))}
      </div>

      {/* Document — click to place the active field */}
      <div onClick={placeField} className="relative cursor-crosshair">
        {children}
        {fields.map((f, i) => (
          <button
            key={i}
            type="button"
            title={s.remove}
            onClick={(e) => {
              e.stopPropagation();
              removeField(i);
            }}
            className="absolute z-10 flex items-center justify-center w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-indigo-600/90 text-white text-[11px] font-bold shadow-md border-2 border-dashed border-white hover:bg-rose-600 transition-colors"
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
          >
            {FIELD_LETTER[f.type]}
          </button>
        ))}
      </div>

      {/* Placed fields */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg pl-3 pr-1.5 py-1.5"
            >
              {s[FIELD_DEFS.find((d) => d.type === f.type)!.labelKey]}
              <button
                type="button"
                onClick={() => removeField(i)}
                title={s.remove}
                className="text-indigo-400 hover:text-rose-600 font-bold px-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Optional signer contact — the link is shared manually by the owner,
          so this is just a note stored on the request record. */}
      <div>
        <label className="block text-xs font-bold text-zinc-700 mb-1.5">
          {s.phone}
        </label>
        <input
          type="text"
          value={contact}
          maxLength={100}
          onChange={(e) => setContact(e.target.value)}
          placeholder={customerPhone ?? ''}
          className="w-full max-w-sm px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
        />
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={send}
        disabled={fields.length === 0 || sending}
        className={cn(primaryBtnClass, 'w-full sm:w-auto')}
      >
        <Link2 size={14} />
        {sending ? '…' : s.sendLink}
      </button>

      <p className="text-[11px] text-zinc-400">{s.legalLine}</p>
    </div>
  );
}

/**
 * Shown after the link is created. WhatsApp opens a prefilled DRAFT —
 * the owner taps send from their own WhatsApp; nothing is sent automatically.
 */
function SignShareSheet({
  token,
  quoteNumber,
  quoteTitle,
  customerName,
  customerPhone,
  regionCode,
  s,
}: {
  token: string;
  quoteNumber: string;
  quoteTitle: string;
  customerName: string;
  customerPhone: string | null;
  regionCode: string | null;
  s: Strings;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/sign/${token}`;
  const message = `Hi ${customerName}, please review and sign quote ${quoteNumber} (${quoteTitle}): ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the user can still select the text.
    }
  }

  return (
    <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-6 space-y-4">
      <h3 className="text-sm font-bold text-zinc-900">{s.shareTitle}</h3>

      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-mono text-zinc-700"
        />
        <button type="button" onClick={copy} className={secondaryBtnClass}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? s.copied : s.copyLink}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <WhatsAppButton
          phone={customerPhone}
          message={message}
          regionCode={regionCode}
        />
      </div>

      <p className="text-[11px] text-zinc-400">{s.shareHint}</p>
      <p className="text-[11px] text-zinc-400">{s.legalLine}</p>
    </div>
  );
}
