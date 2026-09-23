'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, Phone, ArrowRight, Trash2, UserCheck, Plus, X } from 'lucide-react';
import { createLead, updateLeadStatus, deleteLead } from '@/app/actions/leads';
import { convertLeadToCustomer } from '@/app/actions/customers';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';
import { LEAD_STATUSES } from '@/lib/validations';

export type LeadItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  details: string | null;
  source: string | null;
  status: string;
  createdAt: string; // ISO string (serialized across the RSC boundary)
};

const LEAD_SOURCES = ['WhatsApp', 'Phone', 'Website', 'Referral', 'Walk-in', 'Other'];

const NEXT_STATUS: Record<string, string | null> = {
  NEW: 'CONTACTED',
  CONTACTED: 'CONVERTED',
  CONVERTED: null,
};

function StatusButton({ lead, target }: { lead: LeadItem; target: string }) {
  const [, formAction, isPending] = useActionState(updateLeadStatus, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="status" value={target} />
      <button
        type="submit"
        disabled={isPending}
        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 disabled:opacity-50"
      >
        Mark {target.toLowerCase()} <ArrowRight size={12} />
      </button>
    </form>
  );
}

function ConvertButton({ lead }: { lead: LeadItem }) {
  const [state, formAction, isPending] = useActionState(convertLeadToCustomer, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={lead.id} />
      <button
        type="submit"
        disabled={isPending}
        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 disabled:opacity-50"
      >
        <UserCheck size={12} /> {isPending ? 'Converting…' : 'Convert to customer'}
      </button>
      {state?.error && <span className="text-[11px] text-rose-600 ml-1">{state.error}</span>}
    </form>
  );
}

function DeleteButton({ leadId }: { leadId: string }) {
  const [, formAction, isPending] = useActionState(deleteLead, {});
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-[11px] font-semibold text-zinc-400 hover:text-rose-600 inline-flex items-center gap-1"
      >
        <Trash2 size={12} />
      </button>
    );
  }
  return (
    <form action={formAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="id" value={leadId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[11px] font-semibold text-zinc-400"
      >
        Cancel
      </button>
    </form>
  );
}

function LeadCard({ lead }: { lead: LeadItem }) {
  const next = NEXT_STATUS[lead.status] ?? null;
  return (
    <div className="bg-white rounded-xl border border-zinc-200/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-bold text-sm text-zinc-900">{lead.name}</p>
        <DeleteButton leadId={lead.id} />
      </div>
      {lead.phone && (
        <a
          href={`tel:${lead.phone.replace(/\s/g, '')}`}
          className="text-xs text-zinc-600 flex items-center gap-1.5 hover:text-[#6329d4]"
        >
          <Phone size={11} /> {lead.phone}
        </a>
      )}
      {lead.details && <p className="text-xs text-zinc-500 mt-1.5 line-clamp-3">{lead.details}</p>}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100">
        <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">
          {lead.source ?? 'No source'} · {formatDateShort(lead.createdAt)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {next && <StatusButton lead={lead} target={next} />}
        {lead.status !== 'CONVERTED' && <ConvertButton lead={lead} />}
      </div>
    </div>
  );
}

export function AddLeadForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLead, {});

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryBtnClass}>
        <Plus size={14} /> Add lead
      </button>
    );
  }

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-zinc-900">New lead</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
          <X size={16} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name *">
          <input name="name" required placeholder="e.g. Priya Nair" className={inputClass} />
        </Field>
        <Field label="Phone" hint="e.g. +1 416 555 0100">
          <input name="phone" type="tel" placeholder="+1 416 555 0100" className={inputClass} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Email">
          <input name="email" type="email" placeholder="lead@example.com" className={inputClass} />
        </Field>
        <Field label="Source">
          <select name="source" defaultValue="" className={inputClass}>
            <option value="">Select…</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Details" hint="What do they need? e.g. AC not cooling, 2nd floor">
        <textarea name="details" rows={2} placeholder="Describe the enquiry…" className={inputClass} />
      </Field>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? 'Saving…' : 'Save lead'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryBtnClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LeadsBoard({ leads }: { leads: LeadItem[] }) {
  const grouped: Record<string, LeadItem[]> = {};
  for (const s of LEAD_STATUSES) grouped[s] = [];
  for (const lead of leads) {
    (grouped[lead.status] ??= []).push(lead);
  }

  return (
    <div className="grid md:grid-cols-3 gap-4 items-start">
      {LEAD_STATUSES.map((status) => (
        <div key={status} className="bg-zinc-100/70 rounded-2xl p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {status}
            </h3>
            <span className="text-[11px] font-bold bg-white border border-zinc-200 rounded-full px-2 py-0.5 text-zinc-600">
              {grouped[status].length}
            </span>
          </div>
          <div className="space-y-2.5">
            {grouped[status].length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No leads</p>
            ) : (
              grouped[status].map((lead) => <LeadCard key={lead.id} lead={lead} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
