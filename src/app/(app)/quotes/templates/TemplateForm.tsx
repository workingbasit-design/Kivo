'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save, Trash2 } from '@/components/icons';
import {
  createQuoteTemplate,
  deleteQuoteTemplate,
  updateQuoteTemplate,
  type ActionResult,
} from '@/app/actions/quotes';
import LineItemsEditor from '@/components/LineItemsEditor';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button, Card, Input } from '@/components/kit';
import { t, type Locale } from '@/lib/i18n';

export type TemplateItemInput = {
  desc: string;
  qty: string;
  rate: string;
  cost: string;
};

export type TemplateInput = {
  id: string;
  name: string;
  items: TemplateItemInput[];
};

/**
 * Slice 4: create/edit a quote template. Name is CONTROLLED so a failed
 * save (useActionState resets the form element) never wipes it — the
 * JobForm form-reset lesson. Lines are state-owned inside the editor.
 */
export default function TemplateForm({
  template = null,
  fromQuoteTitle = null,
  locale = 'en',
}: {
  template?: TemplateInput | null;
  fromQuoteTitle?: string | null;
  locale?: Locale;
}) {
  const editing = Boolean(template?.id);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    editing ? updateQuoteTemplate : createQuoteTemplate,
    {}
  );
  const [name, setName] = useState(template?.name ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const router = useRouter();
  const seen = useRef<ActionResult | undefined>(undefined);

  // Toast the server error (save actions redirect on success, so only
  // failures land here). Mirrors QuoteForm's failure-only toast.
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.error) {
      import('sonner').then(({ toast }) => toast.error(state.error));
    }
  }, [state]);

  const onDelete = async () => {
    if (!template) return;
    setDeletePending(true);
    setDeleteError(null);
    const r = await deleteQuoteTemplate(template.id);
    setDeletePending(false);
    if (r.error) {
      setDeleteError(r.error);
      return;
    }
    setConfirmingDelete(false);
    router.push('/quotes/templates');
    router.refresh();
  };

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {editing && <input type="hidden" name="id" value={template?.id ?? ''} />}

      {fromQuoteTitle && !editing && (
        <p className="text-sm text-ink-2">
          {t(locale, 'quotes.templates.fromQuoteHint').replace(
            '{title}',
            fromQuoteTitle
          )}
        </p>
      )}

      <Card className="p-6 space-y-4">
        <Input
          label={t(locale, 'quotes.templates.nameLabel')}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder={t(locale, 'quotes.templates.namePlaceholder')}
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-ink mb-3">Line items</h2>
        <LineItemsEditor
          initialItems={template?.items}
          hideDiscount
          currency="CAD"
          locale={locale}
        />
      </Card>

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          <Save size={14} />
          {t(locale, 'quotes.templates.saveTemplate')}
        </Button>
        <Button variant="secondary" href="/quotes/templates">
          {t(locale, 't10money.formCancel')}
        </Button>
        {editing && (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={13} />
              {t(locale, 'quotes.templates.deleteTemplate')}
            </Button>
            <ConfirmDialog
              open={confirmingDelete}
              locale={locale}
              title={t(locale, 'quotes.templates.deleteTemplate')}
              message={t(locale, 'quotes.templates.deleteConfirm')}
              busy={deletePending}
              error={deleteError}
              onConfirm={onDelete}
              onClose={() => !deletePending && setConfirmingDelete(false)}
            />
          </>
        )}
      </div>
    </form>
  );
}
