'use client';

import { useState, useTransition } from 'react';
import { Tag, Plus, Pencil, Trash2, Loader2, Check } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, Field, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import {
  listFieldDefs,
  createFieldDef,
  renameFieldDef,
  deleteFieldDef,
  setFieldValue,
  type CustomFieldDefRow,
  type CustomFieldValueRow,
  type CustomFieldErrorCode,
} from '@/app/actions/custom-fields';

/**
 * Business-defined custom fields ("Gate code", "Dog name"…) with one
 * per-customer value per field. Owners manage field definitions inline and
 * save values directly — empty values clear the field.
 */
export default function CustomerCustomFields({
  customerId,
  locale,
  initial,
}: {
  customerId: string;
  locale: Locale;
  initial: { defs: CustomFieldDefRow[]; values: CustomFieldValueRow[] };
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

  const L = (path: string) => t(locale, path);
  const errMsg = (code: CustomFieldErrorCode) => L(`customfields.errors.${code}`);

  function refresh() {
    startTransition(async () => {
      const res = await listFieldDefs(customerId);
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
    const res = await setFieldValue(customerId, fieldId, values[fieldId] ?? '');
    if (!res.ok) {
      setError(errMsg(res.error));
      return;
    }
    setSavedId(fieldId);
    setTimeout(() => setSavedId((cur) => (cur === fieldId ? null : cur)), 2000);
  }

  async function addDef() {
    setError(null);
    const res = await createFieldDef(newName);
    if (!res.ok) {
      setError(errMsg(res.error));
      return;
    }
    setNewName('');
    setAdding(false);
    refresh();
  }

  async function renameDef(id: string) {
    setError(null);
    const res = await renameFieldDef(id, renameValue);
    if (!res.ok) {
      setError(errMsg(res.error));
      return;
    }
    setRenamingId(null);
    refresh();
  }

  async function removeDef(id: string) {
    if (!window.confirm(L('customfields.deleteConfirm'))) return;
    setError(null);
    const res = await deleteFieldDef(id);
    if (!res.ok) setError(errMsg(res.error));
    else refresh();
  }

  return (
    <Card>
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-zinc-400" />
          <h3 className="font-bold text-sm text-zinc-900">{L('customfields.title')}</h3>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setNewName('');
              setError(null);
            }}
            className={secondaryBtnClass}
          >
            <Plus size={13} /> {L('customfields.addField')}
          </button>
        )}
      </div>

      <div className="px-6 py-4">
        <p className="text-xs text-zinc-500 mb-4">{L('customfields.hint')}</p>

        {error && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        {adding && (
          <div className="flex gap-2 mb-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder={L('customfields.fieldNamePlaceholder')}
              className={inputClass}
              aria-label={L('customfields.fieldName')}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => startTransition(addDef)}
              className={primaryBtnClass}
            >
              {L('customfields.addField')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className={secondaryBtnClass}
            >
              {L('customfields.cancel')}
            </button>
          </div>
        )}

        {defs.length === 0 && !adding ? (
          <p className="text-sm text-zinc-500 text-center py-6">{L('customfields.empty')}</p>
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
                        className={inputClass}
                        aria-label={L('customfields.fieldName')}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startTransition(() => renameDef(def.id))}
                        className={secondaryBtnClass}
                      >
                        {L('customfields.rename')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className={secondaryBtnClass}
                      >
                        {L('customfields.cancel')}
                      </button>
                    </div>
                  ) : (
                    <Field label={def.name}>
                      <input
                        value={values[def.id] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [def.id]: e.target.value }))
                        }
                        maxLength={500}
                        placeholder={L('customfields.valuePlaceholder')}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
                {renamingId !== def.id && (
                  <div className="flex items-center gap-1 pb-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startTransition(() => saveValue(def.id))}
                      className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
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
                      className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                      aria-label={L('customfields.rename')}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => removeDef(def.id))}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
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
    </Card>
  );
}
