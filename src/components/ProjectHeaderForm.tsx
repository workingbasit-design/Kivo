'use client';

import { useState, useTransition } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { updateProject, deleteProject } from '@/app/actions/projects';
import { inputClass, selectClass, primaryBtnClass, dangerBtnClass } from '@/components/ui';
import { Trash2 } from '@/components/icons';
import { useRouter } from 'next/navigation';

const STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
const STATUS_LABEL_KEY: Record<string, string> = {
  ACTIVE: 'projects.statusActive',
  ON_HOLD: 'projects.statusOnHold',
  COMPLETED: 'projects.statusCompleted',
  CANCELLED: 'projects.statusCancelled',
};

export function ProjectHeaderForm({
  locale,
  project,
}: {
  locale: Locale;
  moneyLocale: 'en' | 'fr';
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    budgetCents: number | null;
    customerName: string | null;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  const [status, setStatus] = useState(project.status);
  const [budget, setBudget] = useState(
    project.budgetCents != null ? String(project.budgetCents / 100) : ''
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const budgetCents = budget.trim() === '' ? null : Math.round(Number(budget) * 100);
      const r = await updateProject(project.id, {
        title,
        description,
        status,
        budgetCents: Number.isFinite(budgetCents) ? budgetCents : null,
      });
      if (r.ok) {
        setEditing(false);
        setMsg(t(locale, 'projects.saved'));
      } else setMsg(r.error ?? '');
    });
  };

  const remove = () => {
    if (!confirm(t(locale, 'projects.deleteConfirm'))) return;
    startTransition(async () => {
      const r = await deleteProject(project.id);
      if (r.ok) router.push('/projects');
      else setMsg(r.error ?? '');
    });
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 leading-tight">{project.title}</h1>
          {project.customerName && (
            <p className="text-sm text-zinc-500 mt-0.5">{project.customerName}</p>
          )}
          {project.description && (
            <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap">{project.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-sm font-semibold text-lime-700 hover:underline min-h-[44px] px-2"
        >
          {t(locale, 'projects.edit')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-zinc-600 block mb-1">
          {t(locale, 'projects.titleLabel')}
        </label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-semibold text-zinc-600 block mb-1">
          {t(locale, 'projects.descriptionLabel')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'projects.status')}
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(locale, STATUS_LABEL_KEY[s])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'projects.budgetLabel')}
          </label>
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={inputClass}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      </div>
      {msg && (
        <p className="text-sm text-emerald-700 font-medium" role="status">
          {msg}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={save} disabled={pending} className={primaryBtnClass}>
          {t(locale, 'projects.save')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 min-h-[44px]"
        >
          {t(locale, 'projects.cancel')}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={dangerBtnClass}
          aria-label={t(locale, 'projects.delete')}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
