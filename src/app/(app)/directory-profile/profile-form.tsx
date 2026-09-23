'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { updateDirectoryProfile } from '@/app/actions/directory-profile';
import { Field, inputClass, primaryBtnClass, Card } from '@/components/ui';

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
  const [state, formAction, isPending] = useActionState(updateDirectoryProfile, {});

  return (
    <Card>
      <form action={formAction} className="space-y-5">
        <div>
          <h3 className="font-bold text-sm text-zinc-900">Public profile</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Shown on your directory page. Write it in English and French — French customers see the French version when you provide it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Headline (EN)" hint="e.g. Reliable plumbing, done right">
            <input name="headline" defaultValue={initial.headline} maxLength={120} placeholder="Reliable plumbing, done right" className={inputClass} />
          </Field>
          <Field label="Titre (FR)" hint="p. ex. Plomberie fiable, bien faite">
            <input name="headlineFr" defaultValue={initial.headlineFr} maxLength={120} placeholder="Plomberie fiable, bien faite" className={inputClass} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Short intro (EN)" hint="One or two sentences">
            <textarea name="intro" defaultValue={initial.intro} maxLength={500} rows={2} placeholder="Family-run plumbing serving the east end for 12 years." className={inputClass} />
          </Field>
          <Field label="Présentation (FR)">
            <textarea name="introFr" defaultValue={initial.introFr} maxLength={500} rows={2} placeholder="Plomberie familiale dans l'est depuis 12 ans." className={inputClass} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="About (EN)" hint="Longer description, services, experience">
            <textarea name="description" defaultValue={initial.description} maxLength={2000} rows={4} placeholder="What you do, how long you've done it, what makes you reliable…" className={inputClass} />
          </Field>
          <Field label="À propos (FR)">
            <textarea name="descriptionFr" defaultValue={initial.descriptionFr} maxLength={2000} rows={4} placeholder="Ce que vous faites, votre expérience…" className={inputClass} />
          </Field>
        </div>

        <Field label="Areas served" hint="Comma-separated cities or neighbourhoods, e.g. Toronto, Scarborough, East York">
          <input name="serviceAreas" defaultValue={initial.serviceAreas} maxLength={500} placeholder="Toronto, Scarborough, East York" className={inputClass} />
        </Field>

        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer">
            <input type="checkbox" name="showPhone" defaultChecked={initial.showPhone} className="mt-0.5 accent-zinc-900" />
            <span>
              <span className="font-semibold">Show my phone & WhatsApp on the public profile</span>
              <span className="block text-zinc-500">Uncheck to hide contact buttons — customers can still book online or request a quote.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer">
            <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="mt-0.5 accent-zinc-900" />
            <span>
              <span className="font-semibold">Online booking page enabled</span>
              <span className="block text-zinc-500">Uncheck to pause new online bookings without unpublishing your directory listing.</span>
            </span>
          </label>
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{state.error}</span>
          </div>
        )}
        {state?.ok && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> <span>Profile saved.</span>
          </div>
        )}

        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          {isPending ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </Card>
  );
}
