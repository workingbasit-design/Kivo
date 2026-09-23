'use client';

import { useActionState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateDirectoryProfile } from '@/app/actions/directory-profile';
import { Field, inputClass, primaryBtnClass, Card } from '@/components/ui';
import { useResolvedT } from '@/hooks/useResolvedLocale';

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

/** Editable public directory profile — EN + Canadian French. */
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
          <h3 className="font-bold text-sm text-zinc-900">{t('t10misc.profile.formTitle')}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{t('t10misc.profile.formDesc')}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('t10misc.profile.headlineEn')} hint={t('t10misc.profile.headlineEnHint')}>
            <input name="headline" defaultValue={initial.headline} maxLength={120} placeholder={t('t10misc.profile.headlineEnHint')} className={inputClass} />
          </Field>
          <Field label={t('t10misc.profile.headlineFr')} hint={t('t10misc.profile.headlineFrHint')}>
            <input name="headlineFr" defaultValue={initial.headlineFr} maxLength={120} placeholder={t('t10misc.profile.headlineFrHint')} className={inputClass} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('t10misc.profile.introEn')} hint={t('t10misc.profile.introEnHint')}>
            <textarea name="intro" defaultValue={initial.intro} maxLength={500} rows={2} className={inputClass} />
          </Field>
          <Field label={t('t10misc.profile.introFr')}>
            <textarea name="introFr" defaultValue={initial.introFr} maxLength={500} rows={2} className={inputClass} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('t10misc.profile.aboutEn')} hint={t('t10misc.profile.aboutEnHint')}>
            <textarea name="description" defaultValue={initial.description} maxLength={2000} rows={4} className={inputClass} />
          </Field>
          <Field label={t('t10misc.profile.aboutFr')}>
            <textarea name="descriptionFr" defaultValue={initial.descriptionFr} maxLength={2000} rows={4} className={inputClass} />
          </Field>
        </div>

        <Field label={t('t10misc.profile.areasServed')} hint={t('t10misc.profile.areasHint')}>
          <input name="serviceAreas" defaultValue={initial.serviceAreas} maxLength={500} className={inputClass} />
        </Field>

        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer">
            <input type="checkbox" name="showPhone" defaultChecked={initial.showPhone} className="mt-0.5 w-5 h-5 accent-zinc-900 shrink-0" />
            <span>
              <span className="font-semibold">{t('t10misc.profile.showPhone')}</span>
              <span className="block text-zinc-500">{t('t10misc.profile.showPhoneHint')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer">
            <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="mt-0.5 w-5 h-5 accent-zinc-900 shrink-0" />
            <span>
              <span className="font-semibold">{t('t10misc.profile.bookingEnabled')}</span>
              <span className="block text-zinc-500">{t('t10misc.profile.bookingEnabledHint')}</span>
            </span>
          </label>
        </div>

        {state?.error && (
          <div role="alert" className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{state.error}</span>
          </div>
        )}

        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? t('t10misc.profile.saving') : t('t10misc.profile.saveProfile')}
        </button>
      </form>
    </Card>
  );
}
