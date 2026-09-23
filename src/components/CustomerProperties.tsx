'use client';

import { useState, useTransition } from 'react';
import { MapPin, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Card, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  listProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  setPrimaryProperty,
  type PropertyRow,
  type PropertyErrorCode,
} from '@/app/actions/customer-properties';

/**
 * A customer's properties (home, cottage, job sites). The owner can add,
 * edit, delete, and mark one primary — all tenant-scoped server-side.
 */
export default function CustomerProperties({
  customerId,
  locale,
  initial,
}: {
  customerId: string;
  locale: Locale;
  initial: PropertyRow[];
}) {
  const [properties, setProperties] = useState<PropertyRow[]>(initial);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const L = (path: string) => t(locale, path);
  const errMsg = (code: PropertyErrorCode) => L(`properties.errors.${code}`);

  function refresh() {
    startTransition(async () => {
      const res = await listProperties(customerId);
      if (res.ok && res.properties) {
        setProperties(res.properties);
      } else if (!res.ok) {
        setError(errMsg(res.error));
      }
    });
  }

  function openAdd() {
    setAdding(true);
    setEditingId(null);
    setLabel('');
    setAddress('');
    setNotes('');
    setError(null);
  }

  function openEdit(p: PropertyRow) {
    setAdding(false);
    setEditingId(p.id);
    setLabel(p.label);
    setAddress(p.address);
    setNotes(p.notes ?? '');
    setError(null);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  async function save() {
    setError(null);
    const payload = { label, address, notes };
    const res =
      editingId != null
        ? await updateProperty(editingId, payload)
        : await addProperty(customerId, payload);
    if (!res.ok) {
      setError(errMsg(res.error));
      toast.error(errMsg(res.error));
      return;
    }
    toast.success(L('properties.save'));
    closeForm();
    refresh();
  }

  async function remove(id: string) {
    setError(null);
    const res = await deleteProperty(id);
    if (!res.ok) {
      setError(errMsg(res.error));
      toast.error(errMsg(res.error));
    } else {
      refresh();
    }
  }

  async function makePrimary(id: string) {
    setError(null);
    const res = await setPrimaryProperty(id);
    if (!res.ok) setError(errMsg(res.error));
    else refresh();
  }

  const showForm = adding || editingId != null;

  return (
    <Card>
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-zinc-400" />
          <h3 className="font-bold text-sm text-zinc-900">{L('properties.title')}</h3>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => startTransition(openAdd)}
            className={secondaryBtnClass}
          >
            <Plus size={13} /> {L('properties.add')}
          </button>
        )}
      </div>

      <div className="px-6 py-4">
        <p className="text-xs text-zinc-500 mb-4">{L('properties.hint')}</p>

        {error && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        {showForm && (
          <div className="space-y-3 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-4 mb-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={L('properties.label')}>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={60}
                  placeholder={L('properties.labelPlaceholder')}
                  className={inputClass}
                />
              </Field>
              <Field label={L('properties.address')}>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={500}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label={L('properties.notes')}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={2}
                className={inputClass}
              />
            </Field>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => startTransition(save)}
                className={primaryBtnClass}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                {busy ? L('properties.saving') : L('properties.save')}
              </button>
              <button type="button" onClick={closeForm} className={secondaryBtnClass}>
                {L('properties.cancel')}
              </button>
            </div>
          </div>
        )}

        {properties.length === 0 && !showForm ? (
          <p className="text-sm text-zinc-500 text-center py-6">{L('properties.empty')}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {properties.map((p) => (
              <li key={p.id} className="py-3.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2 flex-wrap">
                    {p.label}
                    {p.isPrimary && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                        <Star size={10} /> {L('properties.primary')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 whitespace-pre-line">{p.address}</p>
                  {p.notes && (
                    <p className="text-xs text-zinc-400 mt-1 whitespace-pre-line">{p.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!p.isPrimary && (
                    <button
                      type="button"
                      title={L('properties.setPrimary')}
                      onClick={() => startTransition(() => makePrimary(p.id))}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-amber-600 hover:bg-amber-50"
                      aria-label={L('properties.setPrimary')}
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startTransition(() => openEdit(p))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                    aria-label={L('properties.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(p.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                    aria-label={L('properties.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        locale={locale}
        title={t(locale, 't10misc.confirm.deleteFieldTitle')}
        message={L('properties.deleteConfirm')}
        onConfirm={() => {
          const id = pendingDelete;
          setPendingDelete(null);
          if (id) startTransition(() => remove(id));
        }}
        onClose={() => setPendingDelete(null)}
      />
    </Card>
  );
}
