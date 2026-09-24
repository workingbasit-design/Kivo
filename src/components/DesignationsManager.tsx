'use client';

import { useState, useTransition } from 'react';
import { Award, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  Badge,
  Field,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  selectClass,
} from '@/components/ui';
import {
  createDesignation,
  deleteDesignation,
  updateDesignation,
} from '@/app/actions/designations';
import { DESIGNATION_TYPES, type DesignationType } from '@/lib/designations';

export type DesignationRow = {
  id: string;
  type: string;
  title: string;
  issuer: string | null;
  number: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
};

const emptyForm: {
  type: DesignationType;
  title: string;
  issuer: string;
  number: string;
  issuedAt: string;
  expiresAt: string;
} = { type: 'LICENSE', title: '', issuer: '', number: '', issuedAt: '', expiresAt: '' };

function toInputDate(d: Date | null): string {
  if (!d) return '';
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function fmtDate(d: Date | null, locale: Locale): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      dateStyle: 'medium',
    });
  } catch {
    return '';
  }
}

export default function DesignationsManager({
  locale,
  initial,
}: {
  locale: Locale;
  initial: DesignationRow[];
}) {
  const tr = (p: string) => t(locale, p);
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pending, startTransition] = useTransition();

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEdit = (row: DesignationRow) => {
    setEditingId(row.id);
    setForm({
      type: row.type as DesignationType,
      title: row.title,
      issuer: row.issuer ?? '',
      number: row.number ?? '',
      issuedAt: toInputDate(row.issuedAt),
      expiresAt: toInputDate(row.expiresAt),
    });
    setShowForm(true);
  };

  const save = () =>
    startTransition(async () => {
      const res = editingId
        ? await updateDesignation(editingId, form)
        : await createDesignation(form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tr('credentials.saved'));
      setShowForm(false);
      setForm(emptyForm);
      // Refresh the list from the server (scoped to this business).
      const { listDesignations } = await import('@/app/actions/designations');
      setItems(await listDesignations());
    });

  const remove = (id: string) => {
    if (!window.confirm(tr('credentials.deleteConfirm'))) return;
    startTransition(async () => {
      const res = await deleteDesignation(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tr('credentials.removed'));
      setItems((prev) => prev.filter((x) => x.id !== id));
    });
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-xs text-zinc-500">{tr('credentials.empty')}</p>
      )}
      <ul className="space-y-2">
        {items.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3"
          >
            <div className="p-1.5 rounded-lg bg-lime/20 text-ink shrink-0 mt-0.5">
              <Award size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 truncate">{d.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                <Badge>{tr(`credentials.types.${d.type}`)}</Badge>
                {d.issuer && <span>{d.issuer}</span>}
                {d.number && <span>#{d.number}</span>}
                <span>
                  {d.expiresAt
                    ? `${tr('credentials.expires')} ${fmtDate(d.expiresAt, locale)}`
                    : tr('credentials.noExpiry')}
                </span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(d)}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label={tr('credentials.editBtn')}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(d.id)}
                disabled={pending}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600"
                aria-label={tr('credentials.deleteBtn')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!showForm ? (
        <button type="button" onClick={openAdd} className={secondaryBtnClass}>
          <Plus size={14} /> {tr('credentials.addBtn')}
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-zinc-900">{tr('credentials.addBtn')}</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-200"
              aria-label={tr('credentials.cancel')}
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={tr('credentials.formType')}>
              <select value={form.type} onChange={set('type')} className={selectClass}>
                {DESIGNATION_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {tr(`credentials.types.${tp}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr('credentials.formTitle')}>
              <input
                value={form.title}
                onChange={set('title')}
                className={inputClass}
                placeholder={tr('credentials.formTitlePh')}
                maxLength={120}
              />
            </Field>
            <Field label={tr('credentials.formIssuer')}>
              <input
                value={form.issuer}
                onChange={set('issuer')}
                className={inputClass}
                placeholder={tr('credentials.formIssuerPh')}
                maxLength={120}
              />
            </Field>
            <Field label={tr('credentials.formNumber')}>
              <input
                value={form.number}
                onChange={set('number')}
                className={inputClass}
                placeholder={tr('credentials.formNumberPh')}
                maxLength={60}
              />
            </Field>
            <Field label={tr('credentials.formIssued')}>
              <input type="date" value={form.issuedAt} onChange={set('issuedAt')} className={inputClass} />
            </Field>
            <Field label={tr('credentials.formExpires')}>
              <input type="date" value={form.expiresAt} onChange={set('expiresAt')} className={inputClass} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className={primaryBtnClass}>
              {tr('credentials.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className={secondaryBtnClass}>
              {tr('credentials.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
