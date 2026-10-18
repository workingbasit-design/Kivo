'use client';

import { useState, useTransition } from 'react';
import { Award, Pencil, Plus, Trash2, X } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  Button,
  BottomSheet,
  Input,
  Select,
  StatusBadge,
} from '@/components/kit';
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
    // Dates are stored as UTC midnight; format in UTC so the calendar date
    // shown matches the date entered, whatever the viewer's timezone is.
    return new Date(d).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      dateStyle: 'medium',
      timeZone: 'UTC',
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
  /** Id of the credential awaiting delete confirmation (in-app dialog). */
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const askRemove = (id: string) => setDeleteId(id);

  const confirmRemove = () => {
    const id = deleteId;
    if (!id) return;
    startTransition(async () => {
      const res = await deleteDesignation(id);
      setDeleteId(null);
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
        <p className="text-xs text-ink-2">{tr('credentials.empty')}</p>
      )}
      <ul className="space-y-2">
        {items.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
          >
            <div className="p-1.5 rounded-lg bg-hivis/20 text-ink shrink-0 mt-0.5">
              <Award size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{d.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-2">
                <StatusBadge tone="neutral">{tr(`credentials.types.${d.type}`)}</StatusBadge>
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
                className="p-1.5 rounded-lg text-ink-2 hover:bg-surface-2"
                aria-label={tr('credentials.editBtn')}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => askRemove(d.id)}
                disabled={pending}
                className="p-1.5 rounded-lg text-ink-2 hover:bg-danger-bg hover:text-danger"
                aria-label={tr('credentials.deleteBtn')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!showForm ? (
        <Button variant="secondary" type="button" onClick={openAdd}>
          <Plus size={14} /> {tr('credentials.addBtn')}
        </Button>
      ) : (
        <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">{tr('credentials.addBtn')}</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 rounded-lg text-ink-2 hover:bg-line"
              aria-label={tr('credentials.cancel')}
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={tr('credentials.formType')}
              value={form.type}
              onChange={set('type')}
              options={DESIGNATION_TYPES.map((tp) => ({
                value: tp,
                label: tr(`credentials.types.${tp}`),
              }))}
            />
            <Input
              label={tr('credentials.formTitle')}
              value={form.title}
              onChange={set('title')}
              placeholder={tr('credentials.formTitlePh')}
              maxLength={120}
            />
            <Input
              label={tr('credentials.formIssuer')}
              value={form.issuer}
              onChange={set('issuer')}
              placeholder={tr('credentials.formIssuerPh')}
              maxLength={120}
            />
            <Input
              label={tr('credentials.formNumber')}
              value={form.number}
              onChange={set('number')}
              placeholder={tr('credentials.formNumberPh')}
              maxLength={60}
            />
            <Input
              label={tr('credentials.formIssued')}
              type="date"
              value={form.issuedAt}
              onChange={set('issuedAt')}
            />
            <Input
              label={tr('credentials.formExpires')}
              type="date"
              value={form.expiresAt}
              onChange={set('expiresAt')}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              type="button"
              onClick={save}
              disabled={pending}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {tr('credentials.save')}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>
              {tr('credentials.cancel')}
            </Button>
          </div>
        </div>
      )}

      <BottomSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title={tr('credentials.deleteConfirm')}
        footer={
          <div className="mt-5 flex gap-2 justify-end">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDeleteId(null)}
            >
              {tr('credentials.cancel')}
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={confirmRemove}
              disabled={pending}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {tr('credentials.deleteBtn')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2">
          {items.find((x) => x.id === deleteId)?.title}
        </p>
      </BottomSheet>
    </div>
  );
}
