'use client';

import { useState, useEffect, useTransition } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import {
  setPhaseStatus,
  deletePhase,
  addPhase,
  attachJobToProject,
  detachJobFromProject,
} from '@/app/actions/projects';
import { Button, Input, Select } from '@/components/kit';
import { Plus, Trash2, X, Check } from '@/components/icons';
import Link from 'next/link';

export interface PhaseJob {
  id: string;
  title: string;
  status: string;
  price: number;
  customerName: string;
  date: string;
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  status: string;
  jobs: PhaseJob[];
}

const NEXT_STATUS: Record<string, string> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
};

const PHASE_TONE: Record<string, string> = {
  TODO: 'bg-surface-2 text-ink-2',
  IN_PROGRESS: 'bg-info-bg text-info',
  DONE: 'bg-ok-bg text-ok',
};

export function PhaseCard({
  locale,
  projectId,
  phase,
  moneyLocale,
}: {
  locale: Locale;
  projectId: string;
  phase: Phase;
  moneyLocale: 'en' | 'fr';
}) {
  const [pending, startTransition] = useTransition();
  const [attaching, setAttaching] = useState(false);

  const cycle = () =>
    startTransition(async () => {
      await setPhaseStatus(phase.id, NEXT_STATUS[phase.status] ?? 'TODO');
    });
  const remove = () => {
    if (!confirm(t(locale, 'projects.deleteConfirm'))) return;
    startTransition(async () => {
      await deletePhase(phase.id);
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-ink">{phase.name}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycle}
            disabled={pending}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full min-h-[36px] ${PHASE_TONE[phase.status] ?? PHASE_TONE.TODO}`}
            aria-label={t(locale, 'projects.status')}
          >
            {phase.status === 'TODO'
              ? t(locale, 'projects.phaseTodo')
              : phase.status === 'IN_PROGRESS'
                ? t(locale, 'projects.phaseInProgress')
                : t(locale, 'projects.phaseDone')}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="p-2 rounded-lg text-ink-2 hover:text-danger hover:bg-danger-bg min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t(locale, 'projects.delete')}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      {phase.jobs.length === 0 ? (
        <p className="text-xs text-ink-2 py-1">{t(locale, 'projects.noJobs')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {phase.jobs.map((j) => (
            <li key={j.id} className="flex items-center gap-2 py-2">
              <Link
                href={`/jobs/${j.id}`}
                className="flex-1 min-w-0 text-sm font-medium text-ink hover:underline truncate"
              >
                {j.title}
                <span className="block text-xs font-normal text-ink-2 truncate">
                  {j.customerName} · {j.date}
                </span>
              </Link>
              <span className="text-xs font-bold text-ink tabular-nums shrink-0">
                {formatMoney(j.price, 'CAD', moneyLocale)}
              </span>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await detachJobFromProject(j.id);
                  })
                }
                disabled={pending}
                className="p-1.5 rounded-lg text-ink-2 hover:text-danger min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label={t(locale, 'projects.detach')}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {attaching ? (
        <AttachJobForm
          locale={locale}
          projectId={projectId}
          phaseId={phase.id}
          onDone={() => setAttaching(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAttaching(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline min-h-[36px]"
        >
          <Plus size={14} aria-hidden /> {t(locale, 'projects.attachJob')}
        </button>
      )}
    </div>
  );
}

export function AddPhaseForm({ locale, projectId }: { locale: Locale; projectId: string }) {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await addPhase(projectId, name);
      if (r.ok) setName('');
      else setError(r.error ?? '');
    });
  };

  return (
    <form onSubmit={submit} className="flex gap-2 items-start">
      <div className="flex-1 min-w-0">
        <Input
          label={<span className="sr-only">{t(locale, 'projects.addPhase')}</span>}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(locale, 'projects.phasePlaceholder')}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
        {t(locale, 'projects.addPhase')}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

function AttachJobForm({
  locale,
  projectId,
  phaseId,
  onDone,
}: {
  locale: Locale;
  projectId: string;
  phaseId: string;
  onDone: () => void;
}) {
  const [jobs, setJobs] = useState<{ id: string; title: string }[] | null>(null);
  const [selected, setSelected] = useState('');
  const [pending, startTransition] = useTransition();

  // Lazy-load attachable jobs on open.
  useEffect(() => {
    fetch(`/api/projects/${projectId}/attachable-jobs`)
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => setJobs([]));
  }, [projectId]);

  const submit = () => {
    if (!selected) return;
    startTransition(async () => {
      await attachJobToProject(selected, projectId, phaseId);
      onDone();
    });
  };

  return (
    <div className="mt-2 flex gap-2 items-start">
      <div className="flex-1 min-w-0">
        <Select
          label={<span className="sr-only">{t(locale, 'projects.attachJob')}</span>}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          options={[
            { value: '', label: t(locale, 'projects.attachJobHint') },
            ...(jobs ?? []).map((j) => ({ value: j.id, label: j.title })),
          ]}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={submit}
        disabled={pending || !selected}
        aria-label={t(locale, 'projects.attachJob')}
      >
        <Check size={16} aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onDone}
        aria-label={t(locale, 'projects.detach')}
      >
        <X size={16} aria-hidden />
      </Button>
    </div>
  );
}

