'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Trash2 } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { updateCrew, deleteCrew, addMember, removeMember, createCrew } from '@/app/actions/crews';

const CREW_COLORS = ['#a3e635', '#38bdf8', '#fbbf24', '#f472b6', '#a78bfa', '#34d399'];

export interface CrewFormMember {
  id: string;
  name: string;
}

export interface CrewFormInitial {
  id: string;
  name: string;
  color: string | null;
  members: CrewFormMember[];
}

export function CrewForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: CrewFormInitial;
}) {
  const L = (k: string) => t(locale, `crews.${k}`);
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color ?? CREW_COLORS[0]);
  const [newMember, setNewMember] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? okMsg : (r.error ?? ''));
    });
  };

  return (
    <div className="space-y-5">
      <Field label={L('name')}>
        <input
          name="crew-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={L('namePlaceholder')}
          maxLength={60}
          className={inputClass}
        />
      </Field>

      <div>
        <span className="block text-sm font-semibold text-zinc-900 mb-2">{L('color')}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={L('color')}>
          {CREW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 transition-transform ${
                color === c ? 'border-zinc-900 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => updateCrew(initial.id, name, color), L('updated'))}
        className={`${primaryBtnClass} w-full min-h-[44px] disabled:opacity-50`}
      >
        {L('save')}
      </button>

      <div>
        <span className="block text-sm font-semibold text-zinc-900 mb-2">
          {L('members')} · {initial.members.length}
        </span>
        {initial.members.length > 0 && (
          <ul className="space-y-2 mb-3">
            {initial.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 min-h-[44px]"
              >
                <span className="text-sm font-medium text-zinc-900 truncate">{m.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeMember(m.id), L('memberRemoved'))}
                  aria-label={`${L('removeMember')}: ${m.name}`}
                  className="shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <X size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder={L('memberPlaceholder')}
            maxLength={80}
            className={`${inputClass} flex-1`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                run(() => addMember(initial.id, newMember).then((r) => {
                  if (r.ok) setNewMember('');
                  return r;
                }), L('memberAdded'));
              }
            }}
          />
          <button
            type="button"
            disabled={pending || newMember.trim().length < 2}
            onClick={() =>
              run(() => addMember(initial.id, newMember).then((r) => {
                if (r.ok) setNewMember('');
                return r;
              }), L('memberAdded'))
            }
            className="shrink-0 min-w-[44px] min-h-[44px] px-4 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus size={16} aria-hidden /> {L('addMember')}
          </button>
        </div>
      </div>

      {confirmingDelete ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
          <p className="text-sm text-rose-800">{L('deleteConfirm')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteCrew(initial.id), L('deleted'))}
              className="min-h-[44px] px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {L('delete')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="min-h-[44px] px-4 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700"
            >
              {L('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
        >
          <Trash2 size={16} aria-hidden /> {L('delete')}
        </button>
      )}

      {msg && (
        <p className="text-sm font-medium text-zinc-700" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Inline create form used on the crews list page. */
export function CrewCreateForm({ locale }: { locale: Locale }) {
  const L = (k: string) => t(locale, `crews.${k}`);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CREW_COLORS[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await createCrew(name, color);
      if (r.ok) {
        setName('');
        setMsg(L('created'));
      } else {
        setMsg(r.error ?? '');
      }
    });
  };

  return (
    <div className="space-y-4">
      <Field label={L('name')}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={L('namePlaceholder')}
          maxLength={60}
          className={inputClass}
        />
      </Field>
      <div>
        <span className="block text-sm font-semibold text-zinc-900 mb-2">{L('color')}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={L('color')}>
          {CREW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 transition-transform ${
                color === c ? 'border-zinc-900 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={pending || name.trim().length < 2}
        onClick={create}
        className={`${primaryBtnClass} w-full min-h-[44px] disabled:opacity-50`}
      >
        {L('create')}
      </button>
      {msg && (
        <p className="text-sm font-medium text-zinc-700" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
