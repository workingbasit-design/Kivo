'use client';

import { useEffect, useState, useTransition } from 'react';
import { Tag, Plus, Pencil, Trash2, Loader2, Check } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input } from '@/components/kit';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  type CustomFieldDefRow,
  type CustomFieldValueRow,
  type CustomFieldErrorCode,
  type CustomFieldResult,
} from '@/app/actions/custom-fields';

/**
 * Slice 6: generic custom-field editor shared by customers, properties
 * and jobs. Owners manage field definitions inline and save values
 * directly - empty values clear the field. The thin per-record wrappers
 * (CustomerCustomFields, PropertyCustomFields, JobCustomFields) pass the
 * record's own actions; the customer wrapper preserves the original
 * behavior exactly.
 */
export default function CustomFieldsEditor({
  recordId,
  locale,
  initial,
  titleKey,
  hintKey,
  fetchOnMount = false,
  listAction,
  setAction,
  createAction,
  renameAction,
  deleteAction,
}: {
  recordId: string;
  locale: Locale;
  initial: { defs: CustomFieldDefRow[]; values: CustomFieldValueRow[] };
  titleKey: string;
  hintKey: string;
  /** Property/job pages don't know the defs server-side — load on mount. */
  fetchOnMount?: boolean;
  listAction: (recordId: string) => Promise<CustomFieldResult>;
  setAction: (recordId: string, fieldId: string, value: string) => Promise<CustomFieldResult>;
  createAction: (name: string) => Promise<CustomFieldResult>;
  renameAction: (id: string, name: string) => Promise<CustomFieldResult>;
  deleteAction: (id: string) => Promise<CustomFieldResult>;
}) {
  const [defs, setDefs] = useState<CustomFieldDefRow[]>(initial.defs);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.values.map((v) => [v.fieldId, v.value]))
  );
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const L = (path: string) => t(locale, path);
  const errMsg = (code: CustomFieldErrorCode) => L(`customfields.errors.${code}`);

  // Property/job pages pass empty initial data — load it on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!fetchOnMount || mounted) return;
    let cancelled = false;
    listAction(recordId).then((res) => {
      if (cancelled) return;
      if (res.ok && res.defs && res.values) {
        setDefs(res.defs);
        setValues(Object.fromEntries(res.values.map((v) => [v.fieldId, v.value])));
      } else if (!res.ok) {
        setError(t(locale, `customfields.errors.${res.error}`));
      }
      setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchOnMount, mounted, listAction, recordId, locale]);

  function refresh() {
    startTransition(async () => {
      const res = await listAction(recordId);
      if (res.ok && res.defs && res.values) {
        setDefs(res.defs);
        setValues(Object.fromEntries(res.values.map((v) => [v.fieldId, v.value])));
      } else if (!res.ok) {
        setError(errMsg(res.error));
      }
    });
  }

  async function saveValue(fieldId: string) {
    setError(null);
    const res = await setAction(recordId, fieldId, values[fieldId] ?? '');
    if (!res.ok) {
      setError(errMsg(res.error));
      toast.error(errMsg(res.error));
      return;
    }
    setSavedId(fieldId);
    setTimeout(() => setSavedId((cur) => (cur === fieldId ? null : cur)), 2000);
  }

  async function addDef() {
    setError(null);
    const res = await createAction(newName);
    if (!res.ok) {
      setError(errMsg(res.error));
      toast.error(errMsg(res.error));
      return;
    }
    setNewName('');
    setAdding(false);
    refresh();
  }

  async function renameDef(id: string) {
    setError(null);
    const res = await renameAction(id, renameValue);
    if (!res.ok) {
      setError(errMsg(res.error));
      return;
    }
    setRenamingId(null);
    refresh();
  }

  async function removeDef(id: string) {
    setConfirmingDeleteId(null);
    setError(null);
    const res = await deleteAction(id);
    if (!res.ok) setError(errMsg(res.error));
    else refresh();
  }

  return (
    <Card>
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-ink-2" />
          <h3 className="font-bold text-sm text-ink">{L(titleKey)}</h3>
        </div>
        {!adding && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setAdding(true);
                setNewName('');
                setError(null);
              }}
            >
              <Plus size={13} /> {L('customfields.addField')}
            </Button>
        )}
      </div>

      <div className="px-6 py-4">
        <p className="text-xs text-ink-2 mb-4">{L(hintKey)}</p>

        {error && (
          <p className="text-xs font-semibold text-danger bg-danger-bg border border-danger/30 rounded-xl px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        {adding && (
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder={L('customfields.fieldNamePlaceholder')}
              className="input flex-1 min-w-[160px]"
              aria-label={L('customfields.fieldName')}
            />
            <Button
              variant="primary"
              type="button"
              disabled={busy}
              onClick={() => startTransition(addDef)}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {L('customfields.addField')}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAdding(false)}
            >
              {L('customfields.cancel')}
            </Button>
          </div>
        )}

        {defs.length === 0 && !adding ? (
          <p className="text-sm text-ink-2 text-center py-6">{L('customfields.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {defs.map((def) => (
              <li key={def.id} className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  {renamingId === def.id ? (
                    <div className="flex gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        maxLength={40}
                        className="input"
                        aria-label={L('customfields.fieldName')}
                      />
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => startTransition(() => renameDef(def.id))}
                        className="disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {L('customfields.rename')}
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setRenamingId(null)}
                      >
                        {L('customfields.cancel')}
                      </Button>
                    </div>
                  ) : (
                    <Input
                      label={def.name}
                      value={values[def.id] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [def.id]: e.target.value }))
                      }
                      maxLength={500}
                      placeholder={L('customfields.valuePlaceholder')}
                    />
                  )}
                </div>
                {renamingId !== def.id && (
                  <div className="flex items-center gap-1 pb-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startTransition(() => saveValue(def.id))}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ok hover:bg-ok-bg disabled:opacity-50"
                      title={L('customfields.save')}
                      aria-label={L('customfields.save')}
                    >
                      {savedId === def.id ? <Check size={14} /> : busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(def.id);
                        setRenameValue(def.name);
                        setError(null);
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink-2 hover:text-ink hover:bg-surface-2"
                      aria-label={L('customfields.rename')}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(def.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink-2 hover:text-danger hover:bg-danger-bg"
                      aria-label={L('customfields.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={confirmingDeleteId !== null}
        title={L('customfields.deleteConfirmTitle')}
        message={L('customfields.deleteConfirm')}
        busy={busy}
        onConfirm={() => confirmingDeleteId && removeDef(confirmingDeleteId)}
        onClose={() => setConfirmingDeleteId(null)}
      />
    </Card>
  );
}
