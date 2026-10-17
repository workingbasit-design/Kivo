'use client';

import { useActionState } from 'react';
import { saveOnboarding, skipOnboarding } from '@/app/actions/onboarding';
import { t, type Locale } from '@/lib/i18n';
import { Radio } from '@/components/design/controls';
import { Select } from '@/components/design/fields';
import { Button } from '@/components/design/Button';
import { Card } from '@/components/ui';

type Initial = { trade: string; teamSize: string; province: string };

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
                <Radio
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
                <Radio
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
            variant="tertiary"
            type="button"
            onClick={() => skipOnboarding()}
            disabled={isPending}
          >
            {tr('support.firstRun.doLater')}
          </Button>
          <Button variant="primary" type="submit" loading={isPending}>
            {tr('support.firstRun.continue')}
          </Button>
        </div>
      </Card>
    </form>
  );
}
