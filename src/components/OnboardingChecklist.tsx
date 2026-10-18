'use client';

import { t, type Locale } from '@/lib/i18n';
import { Card } from '@/components/kit';
import { useStoredFlag } from '@/hooks/useStoredFlag';

export type OnboardingStepId =
  | 'logo'
  | 'customer'
  | 'job'
  | 'quote'
  | 'google'
  | 'team';

export interface OnboardingStep {
  id: OnboardingStepId;
  href: string;
}

const CORE_STEPS: OnboardingStep[] = [
  // Core flow only: a plumber should be working in 2 minutes.
  // Logo, Google, team are in Settings for those who want them.
  { id: 'customer', href: '/customers/new' },
  { id: 'job', href: '/jobs/new' },
  { id: 'quote', href: '/quotes/new' },
];

function storageKey(businessId: string): string {
  return `ej-onboarding-dismissed:${businessId}`;
}

/** i18n path for a step field. Cast needed until the support fragment is wired. */
function stepKey(
  id: OnboardingStepId,
  field: 'title' | 'desc' | 'cta'
): Parameters<typeof t>[1] {
  return `support.steps.${id}.${field}` as Parameters<typeof t>[1];
}

/** Percent progress bar (kit tokens). The kit's MarginBar is profit-specific
 *  and ProgressSteps is a step rail — neither fits a plain percentage bar. */
function OnboardingProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-[11px] font-semibold text-ink-2 mb-1.5">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 rounded-full bg-surface-2 overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-asphalt transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Six-step setup checklist for new businesses.
 *
 * Completion comes from REAL server data - the parent passes `completed`
 * computed from the business's actual state (logo set, customer count,
 * job count, quote/invoice count, Google linked, team size). Dismissal is
 * remembered per business in localStorage.
 *
 * E7: the parent may pass `tailoredSteps` (built from the first-run
 * answers: trade, team size, province). Defaults to the 3 core steps.
 * The progress label always uses the real step count.
 *
 * Mount example (server component):
 *   const completed = {
 *     logo: !!business.logoUrl,
 *     customer: customerCount > 0,
 *     job: jobCount > 0,
 *     quote: quoteCount + invoiceCount > 0,
 *     google: !!business.googleId,
 *     team: teamCount > 1,
 *   };
 *   const steps = [{ id: 'customer', href: '/customers/new' }, ...];
 *   <OnboardingChecklist locale={locale} businessId={business.id} completed={completed} tailoredSteps={steps} />
 */
export default function OnboardingChecklist({
  locale,
  businessId,
  completed,
  tailoredSteps,
}: {
  locale: Locale;
  businessId: string;
  completed: Record<OnboardingStepId, boolean>;
  tailoredSteps?: OnboardingStep[];
}) {
  // Hydration-safe: server snapshot (false) matches the SSR HTML; the real
  // stored value takes over after hydration (useStoredFlag).
  const [dismissed, setDismissed] = useStoredFlag(storageKey(businessId));

  const dismiss = () => setDismissed(true);
  const show = () => setDismissed(false);

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={show}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-2 hover:text-ink hover:border-line-strong hover:bg-surface-2 min-h-[44px] transition-colors"
      >
        {t(locale, 'support.onboardingShow')}
      </button>
    );
  }

  const steps = tailoredSteps ?? CORE_STEPS;
  const done = steps.filter((s) => completed[s.id]).length;
  const total = steps.length;

  // Part A Item 1: When every step is done, remove the card entirely.
  // A completed checklist has served its purpose; keeping it contradicts
  // the "all set up" state.
  if (done === total) {
    return null;
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">
            {t(locale, 'support.onboardingTitle')}
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {t(locale, 'support.onboardingSub')}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-2 hover:text-ink hover:border-line-strong hover:bg-surface-2 min-h-[40px] transition-colors"
        >
          {t(locale, 'support.onboardingDismiss')}
        </button>
      </div>

      <div className="mt-3">
        <OnboardingProgress
          value={done}
          max={total}
          label={`${done} ${t(locale, 'support.onboardingProgressOf')} ${total} ${t(locale, 'support.onboardingProgressDone')}`}
        />
      </div>

      <ol className="mt-4 space-y-2">
          {steps.map((s) => {
            const isDone = !!completed[s.id];
            return (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isDone ? 'border-hivis/30 bg-hivis-soft/60' : 'border-line bg-surface'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isDone ? 'bg-hivis text-hivis-ink' : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {isDone ? '✓' : '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${isDone ? 'text-ink-2 line-through' : 'text-ink'}`}>
                    {t(locale, stepKey(s.id, 'title'))}
                  </div>
                  {!isDone && (
                    <div className="line-clamp-2 text-xs text-ink-2">
                      {t(locale, stepKey(s.id, 'desc'))}
                    </div>
                  )}
                </div>
                {!isDone && (
                  <a
                    href={s.href}
                    className="shrink-0 rounded-lg bg-asphalt px-3 py-2 text-xs font-semibold text-hero-ink hover:bg-hero-2 min-h-[36px] inline-flex items-center"
                  >
                    {t(locale, stepKey(s.id, 'cta'))}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
    </Card>
  );
}
