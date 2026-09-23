'use client';

import React, { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckSquare, Plus, Trash2, AlertCircle, Square } from 'lucide-react';
import { toast } from 'sonner';
import {
  addChecklistItem,
  applyChecklistTemplate,
  toggleChecklistItem,
  deleteChecklistItem,
  type JobOpsActionResult,
} from '@/app/actions/jobops';
import { Card, ProgressBar } from '@/components/ui';
import { jInputClass, jPrimaryBtnClass, jSecondaryBtnClass } from '@/components/jobops-classes';
import ConfirmDialog from '@/components/ConfirmDialog';
import { t, type Locale } from '@/lib/i18n';

export interface ChecklistItemData {
  id: string;
  label: string;
  done: boolean;
}

export interface TemplateOption {
  id: string;
  name: string;
}

/** Checklist card for the job detail page: templates, toggles, ad-hoc items. */
export function JobChecklist({
  jobId,
  items,
  templates,
  locale,
}: {
  jobId: string;
  items: ChecklistItemData[];
  templates: TemplateOption[];
  locale: Locale;
}) {
  const doneCount = items.filter((i) => i.done).length;
  const T = (k: string) => t(locale, `t10work.${k}`);

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <CheckSquare size={14} /> {t(locale, 'jobops.checklist.title')}
          <span className="text-[11px] font-semibold text-graphite tabular-nums">
            {items.length > 0 && `${doneCount} ${t(locale, 'jobops.checklist.ofDone')} ${items.length} ${t(locale, 'jobops.checklist.done')}`}
          </span>
        </h2>
        <Link
          href="/settings/checklists"
          className="text-[11px] font-bold text-ink hover:underline shrink-0 min-h-[44px] inline-flex items-center"
        >
          {t(locale, 'jobops.checklist.manageTemplates')}
        </Link>
      </div>

      {items.length > 0 && (
        <ProgressBar
          value={doneCount}
          max={items.length}
          label={T('checklistProgress')}
          className="mb-4"
        />
      )}

      <ApplyTemplateForm jobId={jobId} templates={templates} locale={locale} />

      {items.length === 0 ? (
        <p className="text-xs text-graphite py-2">
          {t(locale, 'jobops.checklist.empty')}{' '}
          {templates.length > 0 && t(locale, 'jobops.checklist.emptyHint')}
        </p>
      ) : (
        <ul className="divide-y divide-smoke border-t border-smoke mt-2">
          {items.map((item) => (
            <ChecklistRow key={item.id} item={item} locale={locale} />
          ))}
        </ul>
      )}

      <div className="pt-4 border-t border-smoke mt-2">
        <AddItemForm jobId={jobId} locale={locale} />
      </div>
    </Card>
  );
}

function ApplyTemplateForm({
  jobId,
  templates,
  locale,
}: {
  jobId: string;
  templates: TemplateOption[];
  locale: Locale;
}) {
  const [templateId, setTemplateId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);

  if (templates.length === 0) return null;

  const apply = () => {
    if (!templateId) return;
    setError(null);
    startTransition(async () => {
      const res = await applyChecklistTemplate(jobId, templateId);
      if (res?.error) setError(res.error);
      else {
        setTemplateId('');
        toast.success(T('checklistTemplateApplied'));
      }
    });
  };

  return (
    <div className="mb-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-graphite mb-1.5">
        {t(locale, 'jobops.checklist.applyTemplate')}
      </p>
      <div className="flex gap-2">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={`${jInputClass} flex-1 min-w-0`}
          aria-label={t(locale, 'jobops.checklist.chooseTemplate')}
        >
          <option value="">{t(locale, 'jobops.checklist.chooseTemplate')}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={isPending || !templateId}
          className={jSecondaryBtnClass}
        >
          {isPending ? '…' : t(locale, 'jobops.checklist.apply')}
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-rose-600 mt-1.5 font-medium">{error}</p>
      )}
    </div>
  );
}

function ChecklistRow({ item, locale }: { item: ChecklistItemData; locale: Locale }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleChecklistItem(item.id, !item.done);
      if (res?.error) {
        setError(res.error);
        toast.error(T('checklistErrorToggle'));
      }
    });
  };

  const runDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteChecklistItem(item.id);
      if (res?.error) {
        setError(res.error);
        toast.error(T('checklistErrorDelete'));
      } else {
        toast.success(T('checklistRemoved'));
      }
    });
  };

  return (
    <li className="py-1.5 flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={item.done}
        aria-label={item.label}
        className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors disabled:opacity-60 ${
          item.done ? 'text-emerald-600' : 'text-zinc-300 hover:text-graphite'
        }`}
      >
        {item.done ? <CheckSquare size={22} /> : <Square size={22} />}
      </button>
      <span
        className={`flex-1 min-w-0 text-sm break-words ${
          item.done ? 'text-graphite line-through' : 'text-ink'
        }`}
      >
        {item.label}
      </span>
      {error && <span className="text-[11px] text-rose-600 font-medium">{error}</span>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        title={t(locale, 'jobops.checklist.deleteItem')}
        aria-label={t(locale, 'jobops.checklist.deleteItem')}
        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 disabled:opacity-60"
      >
        <Trash2 size={15} />
      </button>
      <ConfirmDialog
        open={confirming}
        title={t(locale, 'jobops.checklist.deleteItem')}
        message={item.label}
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setConfirming(false)}
      />
    </li>
  );
}

function AddItemForm({ jobId, locale }: { jobId: string; locale: Locale }) {
  const [state, formAction, isPending] = useActionState<JobOpsActionResult, FormData>(
    addChecklistItem,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const T = (k: string) => t(locale, `t10work.${k}`);
  const toastedFor = useRef<JobOpsActionResult | null>(null);

  useEffect(() => {
    if (state?.ok && toastedFor.current !== state) {
      toastedFor.current = state;
      formRef.current?.reset();
      toast.success(t(locale, 't10work.checklistAdded'));
    }
  }, [state, locale]);

  return (
    <form ref={formRef} action={formAction}>
      <div className="flex gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input
          name="label"
          required
          maxLength={200}
          placeholder={t(locale, 'jobops.checklist.addPlaceholder')}
          className={`${jInputClass} flex-1 min-w-0`}
          aria-label={t(locale, 'jobops.checklist.add')}
        />
        <button type="submit" disabled={isPending} className={jPrimaryBtnClass}>
          <Plus size={14} />
          {isPending ? '…' : t(locale, 'jobops.checklist.add')}
        </button>
      </div>
      {state?.error && (
        <div className="mt-2 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </form>
  );
}
