'use client';

import { useActionState } from 'react';
import { saveOnboarding, skipOnboarding } from '@/app/actions/onboarding';
import { t, type Locale } from '@/lib/i18n';
import { Select, Button, Card } from '@/components/kit';
import { Loader2 } from '@/components/icons';

type Initial = { trade: string; teamSize: string; province: string };

/**
 * Radio row — the kit has no Radio component, so this is the design-library
 * Radio inlined with kit tokens (same markup, behaviour and 44px target).
 * Kept local: it is only used by the two fieldsets below.
 */
function RadioRow({
  name,
  value,
  label,
  defaultChecked,
  required,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-1 h-5 w-5 shrink-0 accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <span className="block text-base text-ink">{label}</span>
    </label>
  );
}

/**
 * E7 first-run questions: trade, team size, province.
 * One page, three grouped questions (fewer taps than a stepper, no
 * state loss between steps). "Do later" always available — setup is
 * never forced.
 */
export default function OnboardingQuestions({
  locale,
  trades,
  provinces,
  initial,
}: {
  locale: Locale;
  trades: { key: string; label: string }[];
  provinces: { code: string; name: string }[];
  initial: Initial;
}) {
  const [state, formAction, isPending] = useActionState(saveOnboarding, {});
  const tr = (path: Parameters<typeof t>[1]) => t(locale, path);

  const teamOptions = [
    { value: '1', label: tr('support.firstRun.team1') },
    { value: '2-5', label: tr('support.firstRun.team25') },
    { value: '6+', label: tr('support.firstRun.team6') },
  ];

  return (
    <form action={formAction}>
      <Card className="p-5 md:p-6 space-y-6">
        <fieldset>
          <legend className="text-base font-semibold text-ej-ink mb-2">
            {tr('support.firstRun.qTrade')}
          </legend>
          <div className="divide-y divide-ej-border rounded-xl border border-ej-border">
            {trades.map((trade) => (
              <div key={trade.key} className="px-3">
                <RadioRow
                  name="trade"
                  value={trade.key}
                  label={trade.label}
                  defaultChecked={initial.trade === trade.key}
                  required
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-base font-semibold text-ej-ink mb-2">
            {tr('support.firstRun.qTeam')}
          </legend>
          <div className="divide-y divide-ej-border rounded-xl border border-ej-border">
            {teamOptions.map((opt) => (
              <div key={opt.value} className="px-3">
                <RadioRow
                  name="teamSize"
                  value={opt.value}
                  label={opt.label}
                  defaultChecked={initial.teamSize === opt.value}
                  required
                />
              </div>
            ))}
          </div>
        </fieldset>

        <Select
          label={tr('support.firstRun.qProvince')}
          name="province"
          required
          defaultValue={initial.province}
          options={[
            { value: '', label: '' },
            ...provinces.map((p) => ({ value: p.code, label: p.name })),
          ]}
        />

        {state?.error && (
          <p role="alert" className="text-sm font-medium text-ej-danger">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            variant="ghost"
            type="button"
            onClick={() => skipOnboarding()}
            disabled={isPending}
          >
            {tr('support.firstRun.doLater')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending && (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            )}
            {tr('support.firstRun.continue')}
          </Button>
        </div>
      </Card>
    </form>
  );
}
