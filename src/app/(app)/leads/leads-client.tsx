'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { AlertCircle, Phone, ArrowRight, Trash2, UserCheck, Plus, X } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { createLead, updateLeadStatus, deleteLead } from '@/app/actions/leads';
import { convertLeadToCustomer } from '@/app/actions/customers';
import {
  Card,
  Field,
  FormGrid,
  StatusBadge,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from '@/components/ui';
import { formatDateShort } from '@/lib/utils';
import { LEAD_STATUSES } from '@/lib/validations';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/** Replace `{name}` tokens in a template string (minimal inline fill helper). */
function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export type LeadItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  details: string | null;
  source: string | null;
  status: string;
  declineReason: string | null; // E5: reason captured on decline
  createdAt: string; // ISO string (serialized across the RSC boundary)
};

const LEAD_SOURCES = [
  { value: 'WhatsApp', labelKey: 't10money.leadSrcWhatsapp' },
  { value: 'Phone', labelKey: 't10money.leadSrcPhone' },
  { value: 'Website', labelKey: 't10money.leadSrcWebsite' },
  { value: 'Referral', labelKey: 't10money.leadSrcReferral' },
  { value: 'Walk-in', labelKey: 't10money.leadSrcWalkin' },
  { value: 'Other', labelKey: 't10money.leadSrcOther' },
];

const NEXT_STATUS: Record<string, string | null> = {
  NEW: 'CONTACTED',
  CONTACTED: 'CONVERTED',
  CONVERTED: null,
};

const STATUS_LABEL_KEY: Record<string, string> = {
  NEW: 't10money.leadStatusNew',
  CONTACTED: 't10money.leadStatusContacted',
  CONVERTED: 't10money.leadStatusConverted',
  DECLINED: 't10money.leadStatusDeclined',
};

function statusLabel(status: string, locale: Locale): string {
  const key = STATUS_LABEL_KEY[status];
  return key ? t(locale, key) : status;
}

function StatusButton({ lead, target, locale }: { lead: LeadItem; target: string; locale: Locale }) {
  const [state, formAction, isPending] = useActionState(updateLeadStatus, {});
  useResultToast(state, {
    success: t(locale, 't10money.leadStatusUpdated'),
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="status" value={target} />
      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
      >
        {fill(t(locale, 't10money.leadMark'), {
          status: statusLabel(target, locale).toLowerCase(),
        })}{' '}
        <ArrowRight size={12} />
      </button>
    </form>
  );
}

function ConvertButton({ lead, locale }: { lead: LeadItem; locale: Locale }) {
  const [state, formAction, isPending] = useActionState(convertLeadToCustomer, {});
  useResultToast(state, {
    success: t(locale, 't10money.leadConverted'),
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={lead.id} />
      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-ok hover:text-ok disabled:opacity-50"
      >
        <UserCheck size={12} /> {isPending ? t(locale, 't10money.leadConverting') : t(locale, 't10money.leadConvert')}
      </button>
      {state?.error && <span className="text-[11px] text-danger ml-1">{state.error}</span>}
    </form>
  );
}

function DeleteButton({ leadId, locale }: { leadId: string; locale: Locale }) {
  const [state, formAction, isPending] = useActionState(deleteLead, {});
  const [confirming, setConfirming] = useState(false);
  useResultToast(state, {
    success: t(locale, 't10money.leadDeleted'),
  });
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t(locale, 't10money.leadConfirmDelete')}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs font-semibold text-ink-2 hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    );
  }
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={leadId} />
      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] px-3 inline-flex items-center text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60"
      >
        {t(locale, 't10money.leadConfirmDelete')}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-[44px] px-3 inline-flex items-center text-xs font-semibold text-ink-2"
      >
        {t(locale, 't10money.leadCancel')}
      </button>
    </form>
  );
}

import { BottomSheet } from '@/components/design/overlays';

const DECLINE_REASONS = [
  { value: 'tooFar', labelKey: 't10money.leadDeclineReasonTooFar' },
  { value: 'wrongWork', labelKey: 't10money.leadDeclineReasonWrongWork' },
  { value: 'priceLow', labelKey: 't10money.leadDeclineReasonPriceLow' },
  { value: 'booked', labelKey: 't10money.leadDeclineReasonBooked' },
  { value: 'noResponse', labelKey: 't10money.leadDeclineReasonNoResponse' },
  { value: 'other', labelKey: 't10money.leadDeclineReasonOther' },
];

function DeclineButton({ lead, locale }: { lead: LeadItem; locale: Locale }) {
  const [state, formAction, isPending] = useActionState(updateLeadStatus, {});
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('tooFar');
  const [notes, setNotes] = useState('');
  useResultToast(state, {
    success: t(locale, 't10money.leadStatusUpdated'),
  });

  // E5: decline with reason captured. The reason value is stored on the lead.
  const declineReasonText = () => {
    const reasonLabel = t(locale, DECLINE_REASONS.find((r) => r.value === reason)?.labelKey ?? 't10money.leadDeclineReasonOther');
    return notes.trim() ? `${reasonLabel}: ${notes.trim()}` : reasonLabel;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-danger disabled:opacity-50"
      >
        <X size={12} /> {t(locale, 't10money.leadDecline')}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t(locale, 't10money.leadDeclineTitle')}>
        <form action={formAction} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="id" value={lead.id} />
          <input type="hidden" name="status" value="DECLINED" />
          <input type="hidden" name="declineReason" value={declineReasonText()} />
          <p className="text-sm font-semibold text-ej-ink mb-3">
            {t(locale, 't10money.leadDeclineWhy')}
          </p>
          <div className="space-y-2 mb-4" role="radiogroup" aria-label={t(locale, 't10money.leadDeclineWhy')}>
            {DECLINE_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex items-center gap-3 min-h-[48px] px-3 rounded-xl bg-ej-surface cursor-pointer"
              >
                <input
                  type="radio"
                  name="reasonOption"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm text-ej-ink">{t(locale, r.labelKey)}</span>
              </label>
            ))}
          </div>
          <label className="block text-sm font-semibold text-ej-ink mb-1.5">
            {t(locale, 't10money.leadDeclineNotes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(locale, 't10money.leadDeclineNotesPlaceholder')}
            rows={2}
            className="w-full rounded-xl border border-ej-border bg-ej-bg px-3 py-2.5 text-base text-ej-ink placeholder:text-ej-muted mb-4"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 min-h-[48px] rounded-xl bg-ej-primary text-ej-on-primary text-sm font-bold disabled:opacity-50"
            >
              {isPending ? t(locale, 't10money.leadDeclining') : t(locale, 't10money.leadDeclineConfirm')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[48px] px-4 rounded-xl bg-ej-surface text-sm font-semibold text-ej-ink"
            >
              {t(locale, 't10money.leadCancel')}
            </button>
          </div>
          {state?.error && <p className="text-xs text-ej-danger mt-2">{state.error}</p>}
        </form>
      </BottomSheet>
    </>
  );
}

function LeadCard({ lead, locale }: { lead: LeadItem; locale: Locale }) {
  const next = NEXT_STATUS[lead.status] ?? null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="font-bold text-sm text-ink truncate">{lead.name}</p>
          <div className="mt-1.5">
            <StatusBadge status={statusLabel(lead.status, locale)} />
          </div>
        </div>
        <DeleteButton leadId={lead.id} locale={locale} />
      </div>
      {lead.phone && (
        <a
          href={`tel:${lead.phone.replace(/\s/g, '')}`}
          className="min-h-[44px] inline-flex items-center text-xs text-ink-2 gap-1.5 hover:text-ink font-semibold"
        >
          <Phone size={11} /> {lead.phone}
        </a>
      )}
      {lead.details && <p className="text-xs text-ink-2 mt-1 line-clamp-3">{lead.details}</p>}
      {/* E5: show the captured decline reason on declined leads */}
      {lead.status === 'DECLINED' && lead.declineReason && (
        <p className="text-xs text-ink-2 mt-1">
          {fill(t(locale, 't10money.leadDeclinedReason'), { reason: lead.declineReason })}
        </p>
      )}
      <p className="text-[10px] text-ink-2 font-semibold mt-2">
        {lead.source ?? 'No source'} · {formatDateShort(lead.createdAt)}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 border-t border-line pt-1">
        {next && <StatusButton lead={lead} target={next} locale={locale} />}
        {lead.status !== 'CONVERTED' && lead.status !== 'DECLINED' && (
          <ConvertButton lead={lead} locale={locale} />
        )}
        {(lead.status === 'NEW' || lead.status === 'CONTACTED') && (
          <DeclineButton lead={lead} locale={locale} />
        )}
      </div>
    </Card>
  );
}

export function AddLeadForm({ locale = 'en' }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLead, {});

  useResultToast(state, {
    success: t(locale, 't10money.leadSaved'),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryBtnClass}>
        <Plus size={14} /> {t(locale, 't10money.leadAdd')}
      </button>
    );
  }

  return (
    <form action={formAction} className="ej-glass-card rounded-[20px] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-ink">{t(locale, 't10money.leadNew')}</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t(locale, 't10money.leadClose')}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-ink-2 hover:text-ink-2"
        >
          <X size={16} />
        </button>
      </div>

      <FormGrid>
        <Field label={t(locale, 't10money.leadName')}>
          <input name="name" required placeholder={t(locale, 't10money.leadNamePlaceholder')} className={inputClass} />
        </Field>
        <Field label={t(locale, 't10money.leadPhone')} hint={t(locale, 't10money.leadPhoneHint')}>
          <input name="phone" type="tel" placeholder="+1 416 555 0100" className={inputClass} />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field label={t(locale, 't10money.leadEmail')}>
          <input name="email" type="email" placeholder="lead@example.com" className={inputClass} />
        </Field>
        <Field label={t(locale, 't10money.leadSource')}>
          <select name="source" defaultValue="" className={inputClass}>
            <option value="">{t(locale, 't10money.leadSourceSelect')}</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{t(locale, s.labelKey)}</option>
            ))}
          </select>
        </Field>
      </FormGrid>

      <Field label={t(locale, 't10money.leadDetails')} hint={t(locale, 't10money.leadDetailsHint')}>
        <textarea name="details" rows={2} placeholder={t(locale, 't10money.leadDetailsPlaceholder')} className={inputClass} />
      </Field>

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-rose-200 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? t(locale, 't10money.leadSaving') : t(locale, 't10money.leadSave')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryBtnClass}>
          {t(locale, 't10money.leadCancel')}
        </button>
      </div>
    </form>
  );
}

export function LeadsBoard({ leads, locale = 'en' }: { leads: LeadItem[]; locale?: Locale }) {
  const grouped: Record<string, LeadItem[]> = {};
  for (const s of LEAD_STATUSES) grouped[s] = [];
  for (const lead of leads) {
    (grouped[lead.status] ??= []).push(lead);
  }

  return (
    <div className="grid md:grid-cols-3 gap-4 items-start">
      {LEAD_STATUSES.map((status) => (
        <div key={status} className="bg-surface-2/70 rounded-2xl p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <StatusBadge status={statusLabel(status, locale)} />
            <span className="text-[11px] font-bold bg-surface border border-line rounded-full px-2 py-0.5 text-ink-2">
              {grouped[status].length}
            </span>
          </div>
          <div className="space-y-2.5">
            {grouped[status].length === 0 ? (
              <p className="text-xs text-ink-2 text-center py-6">{t(locale, 't10money.leadNoLeads')}</p>
            ) : (
              grouped[status].map((lead) => <LeadCard key={lead.id} lead={lead} locale={locale} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
