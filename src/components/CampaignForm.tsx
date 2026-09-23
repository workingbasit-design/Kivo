'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, Users } from 'lucide-react';
import {
  createCampaign,
  updateCampaign,
  previewAudience,
  type MarketingResult,
} from '@/app/actions/marketing';
import { renderTemplate, type Audience } from '@/lib/marketing';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass, Card } from '@/components/ui';

const AUDIENCE_KEYS: { value: Audience; labelKey: string; hintKey: string }[] = [
  { value: 'ALL_CUSTOMERS', labelKey: 't10misc.marketing.audienceAll', hintKey: 't10misc.marketing.hintAll' },
  { value: 'WITH_UNPAID', labelKey: 't10misc.marketing.audienceUnpaid', hintKey: 't10misc.marketing.hintUnpaid' },
  { value: 'RECENT_JOBS', labelKey: 't10misc.marketing.audienceRecent', hintKey: 't10misc.marketing.hintRecent' },
];

export default function CampaignForm({
  businessName,
  locale,
  initial,
}: {
  businessName: string;
  locale: Locale;
  initial?: { id: string; name: string; subject: string; body: string; audience: Audience };
}) {
  const router = useRouter();
  const action = initial ? updateCampaign : createCampaign;
  const [state, formAction, pending] = useActionState<MarketingResult, FormData>(action, {});

  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? 'ALL_CUSTOMERS');
  const [preview, setPreview] = useState<{ count: number; sample: { name: string; phone: string | null }[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (state?.ok && state.id) {
      router.push(`/marketing/${state.id}`);
    }
  }, [state, router]);

  async function handlePreview() {
    setPreviewLoading(true);
    const res = await previewAudience(audience);
    setPreviewLoading(false);
    if ('error' in res) {
      setPreview(null);
    } else {
      setPreview(res);
    }
  }

  const audienceHint = AUDIENCE_KEYS.find((a) => a.value === audience)?.hintKey;
  const livePreview = renderTemplate(body || t(locale, 't10misc.marketing.previewFallback'), {
    name: t(locale, 't10misc.marketing.previewSampleName'),
    business: businessName,
  });
  const recipientLine = preview
    ? t(locale, 't10misc.marketing.recipients')
        .replace('{count}', String(preview.count))
        .replace('{s}', preview.count === 1 ? '' : locale === 'fr' ? 's' : 's')
    : '';

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <Card className="p-6 space-y-4">
        <Field label={t(locale, 't10misc.marketing.campaignName')}>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder={t(locale, 't10misc.marketing.campaignNamePlaceholder')}
            className={inputClass}
          />
        </Field>

        <div>
          <Field label={t(locale, 't10misc.marketing.audience')}>
            <select
              name="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className={inputClass}
            >
              {AUDIENCE_KEYS.map((a) => (
                <option key={a.value} value={a.value}>
                  {t(locale, a.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-zinc-400">{audienceHint ? t(locale, audienceHint) : ''}</p>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-semibold text-ink hover:text-graphite disabled:opacity-60"
            >
              <Users size={13} />
              {previewLoading ? t(locale, 't10misc.marketing.checking') : t(locale, 't10misc.marketing.previewAudience')}
            </button>
          </div>
          {preview && (
            <div className="mt-2 bg-smoke border border-smoke rounded-xl px-3 py-2.5">
              <p className="text-xs font-bold text-ink">{recipientLine}</p>
              {preview.sample.length > 0 && (
                <p className="text-[11px] text-ink mt-0.5">
                  {t(locale, 't10misc.marketing.samplePrefix')}{preview.sample.map((s) => s.name).join(', ')}
                  {preview.count > preview.sample.length && '…'}
                </p>
              )}
              {preview.count === 0 && (
                <p className="text-[11px] text-ink mt-0.5">
                  {t(locale, 't10misc.marketing.noMatch')}
                </p>
              )}
            </div>
          )}
        </div>

        <Field label={t(locale, 't10misc.marketing.subject')}>
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={160}
            placeholder={t(locale, 't10misc.marketing.subjectPlaceholder')}
            className={inputClass}
          />
        </Field>

        <Field
          label={t(locale, 't10misc.marketing.message')}
          hint={t(locale, 't10misc.marketing.messageHint')}
        >
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={4000}
            rows={6}
            placeholder={t(locale, 't10misc.marketing.messagePlaceholder')}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-3">
          <Eye size={14} className="text-zinc-400" /> {t(locale, 't10misc.marketing.livePreview')}
        </h3>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-900">{subject || t(locale, 't10misc.marketing.previewSubjectFallback')}</p>
          <p className="text-sm text-zinc-600 mt-1.5 whitespace-pre-wrap">{livePreview}</p>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">
          {t(locale, 't10misc.marketing.previewNote')}
        </p>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={primaryBtnClass}>
          {pending ? t(locale, 't10misc.marketing.savingBtn') : initial ? t(locale, 't10misc.marketing.saveChanges') : t(locale, 't10misc.marketing.saveDraft')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className={secondaryBtnClass}
        >
          {t(locale, 't10misc.marketing.cancel')}
        </button>
      </div>

      <p className="text-[11px] text-zinc-400">
        {t(locale, 't10misc.marketing.neverSends')}
      </p>
    </form>
  );
}
