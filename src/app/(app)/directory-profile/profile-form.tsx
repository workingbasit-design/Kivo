'use client';

import { useActionState, useEffect } from 'react';
import { AlertCircle } from '@/components/icons';
import { toast } from 'sonner';
import { updateDirectoryProfile } from '@/app/actions/directory-profile';

import { useResolvedT } from '@/hooks/useResolvedLocale';
import { Button, Card, Input, Textarea } from '@/components/kit';

export type ProfileInitial = {
  headline: string;
  headlineFr: string;
  intro: string;
  introFr: string;
  description: string;
  descriptionFr: string;
  serviceAreas: string;
  showPhone: boolean;
  enabled: boolean;
};

/** Editable public directory profile - EN + Canadian French. */
export default function DirectoryProfileForm({ initial }: { initial: ProfileInitial }) {
  const { t } = useResolvedT();
  const [state, formAction, isPending] = useActionState(updateDirectoryProfile, {});

  useEffect(() => {
    if (state?.ok) toast.success(t('t10misc.profile.saved'));
    else if (state?.error) toast.error(state.error);
  }, [state, t]);

  return (
    <Card>
      <form action={formAction} className="space-y-5">
        <div>
          <h3 className="font-bold text-sm text-ink">{t('t10misc.profile.formTitle')}</h3>
          <p className="text-xs text-ink-2 mt-0.5">{t('t10misc.profile.formDesc')}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input label={t('t10misc.profile.headlineEn')} hint={t('t10misc.profile.headlineEnHint')} name="headline" defaultValue={initial.headline} maxLength={120} placeholder={t('t10misc.profile.headlineEnHint')} />
          <Input label={t('t10misc.profile.headlineFr')} hint={t('t10misc.profile.headlineFrHint')} name="headlineFr" defaultValue={initial.headlineFr} maxLength={120} placeholder={t('t10misc.profile.headlineFrHint')} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Textarea label={t('t10misc.profile.introEn')} hint={t('t10misc.profile.introEnHint')} name="intro" defaultValue={initial.intro} maxLength={500} rows={2} />
          <Textarea label={t('t10misc.profile.introFr')} name="introFr" defaultValue={initial.introFr} maxLength={500} rows={2} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Textarea label={t('t10misc.profile.aboutEn')} hint={t('t10misc.profile.aboutEnHint')} name="description" defaultValue={initial.description} maxLength={2000} rows={4} />
          <Textarea label={t('t10misc.profile.aboutFr')} name="descriptionFr" defaultValue={initial.descriptionFr} maxLength={2000} rows={4} />
        </div>

        <Input label={t('t10misc.profile.areasServed')} hint={t('t10misc.profile.areasHint')} name="serviceAreas" defaultValue={initial.serviceAreas} maxLength={500} />

        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer">
            <input type="checkbox" name="showPhone" defaultChecked={initial.showPhone} className="mt-0.5 w-5 h-5 accent-ink shrink-0" />
            <span>
              <span className="font-semibold">{t('t10misc.profile.showPhone')}</span>
              <span className="block text-ink-2">{t('t10misc.profile.showPhoneHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer">
            <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="mt-0.5 w-5 h-5 accent-ink shrink-0" />
            <span>
              <span className="font-semibold">{t('t10misc.profile.bookingEnabled')}</span>
              <span className="block text-ink-2">{t('t10misc.profile.bookingEnabledHint')}</span>
            </span>
          </label>
        </div>

        {state?.error && (
          <div role="alert" className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{state.error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? t('t10misc.profile.saving') : t('t10misc.profile.saveProfile')}
        </Button>
      </form>
    </Card>
  );
}
