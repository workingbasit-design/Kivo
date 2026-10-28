'use client';

import { useState, useTransition } from 'react';
import { MapPin, Plus, Pencil, Trash2, Star, Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input, Textarea, Select } from '@/components/kit';
import { CA_PROVINCES } from '@/lib/tax';
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
 * edit, delete, and mark one primary - all tenant-scoped server-side.
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
  const [province, setProvince] = useState('');
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
    setProvince('');
    setError(null);
  }

  function openEdit(p: PropertyRow) {
    setAdding(false);
    setEditingId(p.id);
    setLabel(p.label);
    setAddress(p.address);
    setNotes(p.notes ?? '');
    setProvince(p.province ?? '');
    setError(null);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  async function save() {
    setError(null);
    const payload = { label, address, notes, province: province || null };
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
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-ink-2" />
          <h3 className="font-bold text-sm text-ink">{L('properties.title')}</h3>
        </div>
        {!showForm && (
          <Button
            variant="secondary"
            type="button"
            onClick={() => startTransition(openAdd)}
          >
            <Plus size={13} /> {L('properties.add')}
          </Button>
        )}
      </div>

      <div className="px-6 py-4">
        <p className="text-xs text-ink-2 mb-4">{L('properties.hint')}</p>

        {error && (
          <p className="text-xs font-semibold text-danger bg-danger-bg border border-danger/30 rounded-xl px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        {showForm && (
          <div className="space-y-3 rounded-xl border border-line/70 bg-surface-2/60 p-4 mb-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label={L('properties.label')}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder={L('properties.labelPlaceholder')}
              />
              <Input
                label={L('properties.address')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={500}
              />
            </div>
            <Select
              label={L('properties.province')}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              options={[
                { value: '', label: L('properties.provinceUnknown') },
                ...CA_PROVINCES.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
              ]}
            />
            <Textarea
              label={L('properties.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                type="button"
                disabled={busy}
                onClick={() => startTransition(save)}
                className="disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                {busy ? L('properties.saving') : L('properties.save')}
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={closeForm}
              >
                {L('properties.cancel')}
              </Button>
            </div>
          </div>
        )}

        {properties.length === 0 && !showForm ? (
          <p className="text-sm text-ink-2 text-center py-6">{L('properties.empty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {properties.map((p) => (
              <li key={p.id} className="py-3.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink flex items-center gap-2 flex-wrap">
                    {p.label}
                    {p.province && (
                      <span className="inline-flex items-center text-[10px] font-bold bg-surface-2 text-ink-2 rounded-full px-2 py-0.5">
                        {p.province}
                      </span>
                    )}
                    {p.isPrimary && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-warn-bg text-warn-text rounded-full px-2 py-0.5">
                        <Star size={10} /> {L('properties.primary')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-2 mt-0.5 whitespace-pre-line">{p.address}</p>
                  {p.notes && (
                    <p className="text-xs text-ink-2 mt-1 whitespace-pre-line">{p.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!p.isPrimary && (
                    <button
                      type="button"
                      title={L('properties.setPrimary')}
                      onClick={() => startTransition(() => makePrimary(p.id))}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink-2 hover:text-warn-text hover:bg-warn-bg"
                      aria-label={L('properties.setPrimary')}
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startTransition(() => openEdit(p))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink-2 hover:text-ink hover:bg-surface-2"
                    aria-label={L('properties.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(p.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink-2 hover:text-danger hover:bg-danger-bg"
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
