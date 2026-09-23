'use client';

import React, { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { ListChecks, Pencil, Plus, Trash2, AlertCircle } from 'lucide-react';
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  type JobOpsActionResult,
} from '@/app/actions/jobops';
import { Card } from '@/components/ui';
import { jInputClass, jPrimaryBtnClass, jSecondaryBtnClass } from '@/components/jobops-classes';
import ConfirmDialog from '@/components/ConfirmDialog';
import { t, type Locale } from '@/lib/i18n';

export interface TemplateData {
  id: string;
  name: string;
  items: string[];
}

/** Checklist-template CRUD for /settings/checklists. */
export function ChecklistTemplatesClient({
  templates,
  locale,
}: {
  templates: TemplateData[];
  locale: Locale;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const active = editing && editing !== 'new' ? templates.find((x) => x.id === editing) : null;

  return (
    <div className="space-y-4">
      {templates.length === 0 && editing !== 'new' ? (
        <Card className="p-8 text-center">
          <ListChecks size={28} className="mx-auto text-zinc-300 mb-3" />
          <p className="text-sm font-bold text-ink">{t(locale, 'jobops.templates.empty')}</p>
          <p className="text-xs text-graphite mt-1 mb-4">{t(locale, 'jobops.templates.emptyHint')}</p>
          <button type="button" onClick={() => setEditing('new')} className={jPrimaryBtnClass}>
            <Plus size={14} /> {t(locale, 'jobops.templates.new')}
          </button>
        </Card>
      ) : (
        <>
          {editing === 'new' && (
            <TemplateEditor
              key="new"
              locale={locale}
              onDone={() => setEditing(null)}
            />
          )}
          {templates.map((tpl) =>
            editing === tpl.id && active ? (
              <TemplateEditor
                key={tpl.id}
                locale={locale}
                template={tpl}
                onDone={() => setEditing(null)}
              />
            ) : (
              <TemplateRow
                key={tpl.id}
                template={tpl}
                locale={locale}
                editing={editing !== null}
                onEdit={() => setEditing(tpl.id)}
              />
            )
          )}
          {templates.length > 0 && editing !== 'new' && (
            <button type="button" onClick={() => setEditing('new')} className={jSecondaryBtnClass}>
              <Plus size={14} /> {t(locale, 'jobops.templates.new')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  locale,
  editing,
  onEdit,
}: {
  template: TemplateData;
  locale: Locale;
  editing: boolean;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteChecklistTemplate(template.id);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <ListChecks size={14} className="text-graphite shrink-0" />
            <span className="truncate">{template.name}</span>
          </h3>
          <p className="text-[11px] text-graphite mt-1">
            {template.items.length} {t(locale, 'jobops.templates.items')}
          </p>
          <ul className="mt-2 space-y-1">
            {template.items.slice(0, 5).map((label, i) => (
              <li key={i} className="text-xs text-graphite truncate">
                {i + 1}. {label}
              </li>
            ))}
            {template.items.length > 5 && (
              <li className="text-[11px] text-graphite">…</li>
            )}
          </ul>
          {error && <p className="text-[11px] text-rose-600 mt-2 font-medium">{error}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            disabled={editing || isPending}
            title={t(locale, 'jobops.templates.edit')}
            aria-label={`${t(locale, 'jobops.templates.edit')}: ${template.name}`}
            className="p-2 text-graphite hover:text-ink hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={editing || isPending}
            title={t(locale, 'jobops.templates.delete')}
            aria-label={`${t(locale, 'jobops.templates.delete')}: ${template.name}`}
            className="p-2 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t(locale, 'jobops.templates.deleteTitle')}
        message={t(locale, 'jobops.templates.deleteMessage')}
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setConfirming(false)}
      />
    </Card>
  );
}

function TemplateEditor({
  template,
  locale,
  onDone,
}: {
  template?: TemplateData;
  locale: Locale;
  onDone: () => void;
}) {
  const action = template ? updateChecklistTemplate : createChecklistTemplate;
  const [state, formAction, isPending] = useActionState<JobOpsActionResult, FormData>(
    action,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <Card className="p-5 md:p-6">
      <form ref={formRef} action={formAction} className="space-y-4">
        {template && <input type="hidden" name="id" value={template.id} />}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
            {t(locale, 'jobops.templates.name')}
          </label>
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={template?.name ?? ''}
            placeholder={t(locale, 'jobops.templates.namePlaceholder')}
            className={jInputClass}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">
            {t(locale, 'jobops.templates.itemsLabel')}
          </label>
          <textarea
            name="items"
            required
            rows={6}
            defaultValue={template?.items.join('\n') ?? ''}
            className={`${jInputClass} font-mono text-[13px]`}
          />
          <p className="text-[11px] text-graphite mt-1">{t(locale, 'jobops.templates.itemsHint')}</p>
        </div>
        {state?.error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className={jPrimaryBtnClass}>
            {isPending
              ? '…'
              : template
                ? t(locale, 'jobops.templates.save')
                : t(locale, 'jobops.templates.create')}
          </button>
          <button type="button" onClick={onDone} className={jSecondaryBtnClass}>
            {t(locale, 'jobops.templates.cancel')}
          </button>
        </div>
      </form>
    </Card>
  );
}
