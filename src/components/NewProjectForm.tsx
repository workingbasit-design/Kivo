'use client';

import { useState, useTransition } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { createProject } from '@/app/actions/projects';
import { inputClass, selectClass, textareaClass, primaryBtnClass, Field } from '@/components/ui';
import { useRouter } from 'next/navigation';

export function NewProjectForm({
  locale,
  customers,
}: {
  locale: Locale;
  customers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [phases, setPhases] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const budgetCents =
        budget.trim() === '' ? undefined : Math.round(Number(budget) * 100);
      const r = await createProject({
        title,
        description,
        customerId: customerId || undefined,
        budgetCents: budgetCents != null && Number.isFinite(budgetCents) ? budgetCents : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        phases: phases.split('\n'),
      });
      if (r.ok && r.id) router.push(`/projects/${r.id}`);
      else setError(r.error ?? '');
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <Field label={t(locale, 'projects.titleLabel')}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          required
          minLength={2}
          maxLength={120}
        />
      </Field>

      <Field label={t(locale, 'projects.descriptionLabel')}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={textareaClass}
          rows={3}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t(locale, 'projects.customerLabel')}>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={selectClass}
          >
            <option value="">-</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t(locale, 'projects.budgetLabel')}>
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={inputClass}
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t(locale, 'projects.startLabel')}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t(locale, 'projects.endLabel')}>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
            min={startDate || undefined}
          />
        </Field>
      </div>

      <Field
        label={t(locale, 'projects.phasesLabel')}
        hint={t(locale, 'projects.phasesHint')}
      >
        <textarea
          value={phases}
          onChange={(e) => setPhases(e.target.value)}
          className={textareaClass}
          rows={4}
        />
      </Field>

      {error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryBtnClass}>
        {pending ? '…' : t(locale, 'projects.create')}
      </button>
    </form>
  );
}
