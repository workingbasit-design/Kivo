'use client';

import React, { useActionState, useState } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, Check } from 'lucide-react';
import {
  createQuoteAddon,
  updateQuoteAddon,
  deleteQuoteAddon,
  type ActionResult,
} from '@/app/actions/quotes';
import { formatMoney } from '@/lib/money';

export interface AddonRow {
  id: string;
  title: string;
  price: number;
  selected: boolean;
}

export interface QuoteAddonsStrings {
  title: string;
  hint: string;
  add: string;
  nameLabel: string;
  priceLabel: string;
  edit: string;
  save: string;
  cancel: string;
  delete: string;
  deleteConfirm: string;
  empty: string;
  locked: string;
  errorInvalid: string;
}

/**
 * Owner UI for quote add-ons: add / edit / delete optional extras the
 * client can toggle on the public quote page. Locked once the quote is
 * approved (approved quotes are records).
 */
export default function QuoteAddons({
  quoteId,
  status,
  addons,
  currency,
  strings: s,
}: {
  quoteId: string;
  status: string;
  addons: AddonRow[];
  currency: string;
  strings: QuoteAddonsStrings;
}) {
  const [createState, createAction, createPending] = useActionState<ActionResult, FormData>(
    createQuoteAddon,
    {}
  );
  const [updateState, updateAction, updatePending] = useActionState<ActionResult, FormData>(
    updateQuoteAddon,
    {}
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult, FormData>(
    deleteQuoteAddon,
    {}
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const locked = status === 'APPROVED';
  const error = createState?.error || updateState?.error || deleteState?.error;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-900">{s.title}</h3>
        <p className="text-xs text-graphite mt-0.5">{s.hint}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {locked && (
        <p className="text-xs text-graphite bg-zinc-50 border border-smoke rounded-xl px-3 py-2.5">
          {s.locked}
        </p>
      )}

      {addons.length === 0 ? (
        <p className="text-xs text-graphite">{s.empty}</p>
      ) : (
        <ul className="space-y-2">
          {addons.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 border border-smoke rounded-xl px-3 py-2.5"
            >
              {editingId === a.id && !locked ? (
                <form action={updateAction} className="flex-1 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <label className="flex-1 min-w-[140px]">
                    <span className="text-[11px] font-semibold text-graphite">{s.nameLabel}</span>
                    <input
                      name="title"
                      defaultValue={a.title}
                      required
                      maxLength={200}
                      className="mt-1 w-full rounded-lg border border-smoke px-2.5 py-1.5 text-sm focus:border-ink focus:outline-none"
                    />
                  </label>
                  <label className="w-28">
                    <span className="text-[11px] font-semibold text-graphite">{s.priceLabel}</span>
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={a.price}
                      required
                      className="mt-1 w-full rounded-lg border border-smoke px-2.5 py-1.5 text-sm focus:border-ink focus:outline-none"
                    />
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      disabled={updatePending}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 px-2 py-1.5"
                    >
                      <Check size={13} /> {s.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs font-semibold text-graphite hover:text-zinc-700 px-2 py-1.5"
                    >
                      {s.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-zinc-900 truncate">{a.title}</span>
                    {a.selected && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold text-zinc-900 mr-1">
                      +{formatMoney(a.price, currency)}
                    </span>
                    {!locked && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(a.id);
                            setConfirmingDeleteId(null);
                          }}
                          className="p-1.5 rounded-lg text-graphite hover:bg-smoke hover:text-zinc-800"
                          aria-label={`${s.edit} ${a.title}`}
                        >
                          <Pencil size={13} />
                        </button>
                        {confirmingDeleteId === a.id ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="font-medium text-zinc-600">{s.deleteConfirm}</span>
                            <form action={deleteAction} className="inline">
                              <input type="hidden" name="id" value={a.id} />
                              <button
                                type="submit"
                                disabled={deletePending}
                                className="font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-2.5 py-1 rounded-lg"
                              >
                                {s.delete}
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="font-semibold text-graphite hover:text-zinc-700"
                            >
                              {s.cancel}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingDeleteId(a.id);
                              setEditingId(null);
                            }}
                            className="p-1.5 rounded-lg text-graphite hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`${s.delete} ${a.title}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <div>
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-ink hover:underline"
            >
              <Plus size={14} /> {s.add}
            </button>
          ) : (
            <form
              action={createAction}
              className="border border-smoke rounded-xl p-3.5 space-y-3 bg-paper"
            >
              <input type="hidden" name="quoteId" value={quoteId} />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                <label>
                  <span className="text-[11px] font-semibold text-graphite">{s.nameLabel}</span>
                  <input
                    name="title"
                    required
                    maxLength={200}
                    placeholder={s.nameLabel}
                    className="mt-1 w-full rounded-lg border border-smoke bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
                  />
                </label>
                <label>
                  <span className="text-[11px] font-semibold text-graphite">{s.priceLabel}</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-smoke bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={createPending}
                  className="inline-flex items-center gap-1.5 bg-ink hover:bg-ink/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-semibold text-xs transition-colors"
                >
                  <Plus size={13} /> {createPending ? '…' : s.add}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="text-xs font-semibold text-graphite hover:text-zinc-700 px-2 py-2"
                >
                  {s.cancel}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
