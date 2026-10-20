'use client';

import { useState, useTransition } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { createProject } from '@/app/actions/projects';
import { Input, Textarea, Select, Button } from '@/components/kit';
import { DateField } from '@/components/kit';
import { ArrowUp, ArrowDown, X, Plus, Loader2 } from '@/components/icons';
import { useRouter } from 'next/navigation';

/** Phase templates by trade. Kept as component constants because t() is string-only. */
const PHASE_TEMPLATES: Record<string, Record<Locale, string[]>> = {
  bathroom: {
    en: ['Demolition', 'Rough-in', 'Tile and waterproofing', 'Fixtures and trim', 'Cleanup and handoff'],
    fr: ['Démolition', 'Gros œuvre', 'Carrelage et étanchéité', 'Appareils et finition', 'Nettoyage et remise'],
  },
  kitchen: {
    en: ['Demolition', 'Rough-in', 'Cabinets', 'Countertops and backsplash', 'Appliances and finishing', 'Cleanup and handoff'],
    fr: ['Démolition', 'Gros œuvre', 'Armoires', 'Comptoirs et dosseret', 'Électroménagers et finition', 'Nettoyage et remise'],
  },
  general: {
    en: ['Planning', 'Execution', 'Review', 'Handoff'],
    fr: ['Planification', 'Exécution', 'Révision', 'Remise'],
  },
};

const TEMPLATE_ORDER = ['bathroom', 'kitchen', 'general'] as const;
const TEMPLATE_LABEL_KEYS: Record<(typeof TEMPLATE_ORDER)[number], string> = {
  bathroom: 'projects.templateBathroom',
  kitchen: 'projects.templateKitchen',
  general: 'projects.templateGeneral',
};

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
  const [phases, setPhases] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const movePhase = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[i], next[j]] = [next[j], next[i]];
    setPhases(next);
  };

  const removePhase = (i: number) => setPhases(phases.filter((_, k) => k !== i));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Part A Item 9: End date cannot be before start date.
    if (startDate && endDate && endDate < startDate) {
      setError(t(locale, 'projects.endBeforeStart'));
      return;
    }
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
        phases: phases.map((p) => p.trim()).filter(Boolean),
      });
      if (r.ok && r.id) router.push(`/projects/${r.id}`);
      else setError(r.error ?? '');
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5 max-w-xl">
      <Input
        label={t(locale, 'projects.titleLabel')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={2}
        maxLength={120}
      />

      <Textarea
        label={t(locale, 'projects.descriptionLabel')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Select
            label={t(locale, 'projects.customerLabel')}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={[
              { value: '', label: t(locale, 'projects.noCustomer') },
              ...customers.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <a
            href="/customers/new"
            className="text-sm font-semibold text-ink hover:underline mt-1 inline-block min-h-[44px] py-2"
          >
            {t(locale, 'projects.newCustomer')}
          </a>
        </div>
        {/* Budget — the kit has no MoneyInput, so the $ prefix is composed
            here on the kit `.field`/`.input` classes (same behaviour). */}
        <label className="field" data-kit="input">
          <span>{t(locale, 'projects.budgetLabel')}</span>
          <span className="relative block">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] text-ink-2"
            >
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
              className="input pl-9 tabular-nums"
            />
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="min-w-0">
          <DateField
            label={t(locale, 'projects.startLabel')}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <DateField
            label={t(locale, 'projects.endLabel')}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
          />
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-semibold text-ink mb-1.5">
          {t(locale, 'projects.phasesLabel')}
        </legend>
        <p className="text-sm text-ej-muted mb-3">{t(locale, 'projects.phasesHint')}</p>

        <p className="text-sm font-semibold text-ink mb-2">
          {t(locale, 'projects.phasesTemplateLabel')}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {TEMPLATE_ORDER.map((id) => (
            <Button
              key={id}
              variant="secondary"
              sm
              onClick={() => setPhases([...PHASE_TEMPLATES[id][locale]])}
            >
              {t(locale, TEMPLATE_LABEL_KEYS[id])}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          {phases.map((name, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex-1">
                <Input
                  label={t(locale, 'projects.phaseNameLabel').replace('{n}', String(i + 1))}
                  value={name}
                  onChange={(e) => {
                    const next = [...phases];
                    next[i] = e.target.value;
                    setPhases(next);
                  }}
                />
              </div>
              <Button
                variant="ghost"
                sm
                aria-label={t(locale, 'projects.phaseMoveUp')}
                onClick={() => movePhase(i, -1)}
                disabled={i === 0}
              >
                <ArrowUp size={18} aria-hidden />
              </Button>
              <Button
                variant="ghost"
                sm
                aria-label={t(locale, 'projects.phaseMoveDown')}
                onClick={() => movePhase(i, 1)}
                disabled={i === phases.length - 1}
              >
                <ArrowDown size={18} aria-hidden />
              </Button>
              <Button
                variant="ghost"
                sm
                aria-label={t(locale, 'projects.phaseRemove')}
                onClick={() => removePhase(i)}
              >
                <X size={18} aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => setPhases([...phases, ''])}
          className="mt-2"
        >
          <Plus size={18} aria-hidden className="mr-1" />
          {t(locale, 'projects.addPhaseRow')}
        </Button>
      </fieldset>

      {error && (
        <p className="text-sm text-ej-danger font-medium" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        aria-busy={pending}
      >
        {pending && (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        )}
        {t(locale, 'projects.create')}
      </Button>
    </form>
  );
}
