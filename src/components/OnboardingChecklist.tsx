'use client';

import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { Card, ProgressBar } from '@/components/ui';

export type OnboardingStepId =
  | 'logo'
  | 'customer'
  | 'job'
  | 'quote'
  | 'google'
  | 'team';

const STEPS: { id: OnboardingStepId; href: string }[] = [
  { id: 'logo', href: '/settings' },
  { id: 'customer', href: '/customers' },
  { id: 'job', href: '/jobs' },
  { id: 'quote', href: '/quotes' },
  { id: 'google', href: '/settings' },
  { id: 'team', href: '/settings/team' },
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

/**
 * Six-step setup checklist for new businesses.
 *
 * Completion comes from REAL server data — the parent passes `completed`
 * computed from the business's actual state (logo set, customer count,
 * job count, quote/invoice count, Google linked, team size). Dismissal is
 * remembered per business in localStorage.
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
 *   <OnboardingChecklist locale={locale} businessId={business.id} completed={completed} />
 */
export default function OnboardingChecklist({
  locale,
  businessId,
  completed,
}: {
  locale: Locale;
  businessId: string;
  completed: Record<OnboardingStepId, boolean>;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey(businessId)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [businessId]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey(businessId), '1');
    } catch {
      // private mode etc. — dismissal just won't persist
    }
    setDismissed(true);
  };
  const show = () => {
    try {
      window.localStorage.removeItem(storageKey(businessId));
    } catch {
      // ignore
    }
    setDismissed(false);
  };

  if (dismissed === null) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={show}
        className="text-sm font-medium text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
      >
        {t(locale, 'support.onboardingShow')}
      </button>
    );
  }

  const done = STEPS.filter((s) => completed[s.id]).length;
  const total = STEPS.length;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            {t(locale, 'support.onboardingTitle')}
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            {t(locale, 'support.onboardingSub')}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 min-h-[32px]"
        >
          {t(locale, 'support.onboardingDismiss')}
        </button>
      </div>

      <div className="mt-3">
        <ProgressBar
          value={done}
          max={total}
          label={`${done} ${t(locale, 'support.onboardingProgress')}`}
        />
      </div>

      {done === total ? (
        <p className="mt-4 rounded-xl bg-lime-50 p-4 text-sm font-semibold text-zinc-900" role="status">
          {t(locale, 'support.onboardingAllDone')}
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {STEPS.map((s) => {
            const isDone = !!completed[s.id];
            return (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isDone ? 'border-lime-200 bg-lime-50/60' : 'border-zinc-200 bg-white'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isDone ? 'bg-lime-500 text-white' : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {isDone ? '✓' : '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>
                    {t(locale, stepKey(s.id, 'title'))}
                  </div>
                  {!isDone && (
                    <div className="line-clamp-2 text-xs text-zinc-500">
                      {t(locale, stepKey(s.id, 'desc'))}
                    </div>
                  )}
                </div>
                {!isDone && (
                  <a
                    href={s.href}
                    className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 min-h-[36px] inline-flex items-center"
                  >
                    {t(locale, stepKey(s.id, 'cta'))}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
