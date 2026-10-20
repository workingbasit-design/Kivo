'use client';

import { useActionState, useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, Link2, AlertCircle } from '@/components/icons';
import { toast } from 'sonner';
import { saveBookingSettings } from '@/app/actions/booking';
import { Button, Card, Input, Textarea } from '@/components/kit';
import { slugify } from '@/lib/slug';
import { useResolvedT } from '@/hooks/useResolvedLocale';

const initialState = { error: undefined as string | undefined, ok: undefined as boolean | undefined };

export { slugify };

export default function BookingSettingsForm({
  initial,
  suggestedSlug,
}: {
  initial: { enabled: boolean; slug: string; headline: string; intro: string } | null;
  suggestedSlug: string;
}) {
  const { t } = useResolvedT();
  const [state, formAction, pending] = useActionState(saveBookingSettings, initialState);
  const [slug, setSlug] = useState(initial?.slug ?? suggestedSlug);
  const [copied, setCopied] = useState(false);
  // Read after mount so SSR and the first client render agree (avoids
  // hydration mismatch): lazy initializer runs on the client only.
  const [origin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin
  );
  const publicUrl = `${origin}/book/${slug}`;

  useEffect(() => {
    if (state.ok) toast.success(t('t10misc.booking.saved'));
    else if (state.error) toast.error(state.error);
  }, [state, t]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success(t('t10misc.booking.copiedToast'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('t10misc.misc.draftError'));
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <form action={formAction}>
        <Card className="p-6 space-y-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initial?.enabled ?? true}
              className="mt-1 w-5 h-5 rounded-md border-line-strong accent-ink shrink-0"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">{t('t10misc.booking.enableTitle')}</span>
              <span className="block text-xs text-ink-2 mt-0.5">{t('t10misc.booking.enableDesc')}</span>
            </span>
          </label>

          <div className="field">
            <span>{t('t10misc.booking.linkLabel')}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-2 whitespace-nowrap">/book/</span>
              <input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                minLength={3}
                maxLength={60}
                className="input"
                placeholder={suggestedSlug}
              />
            </div>
            <small>{t('t10misc.booking.linkHint')}</small>
          </div>

          <Input
            label={t('t10misc.booking.headlineLabel')}
            hint={t('t10misc.booking.headlineHint')}
            name="headline"
            defaultValue={initial?.headline ?? ''}
            maxLength={120}
            placeholder={t('t10misc.booking.headlinePlaceholder')}
          />

          <Textarea
            label={t('t10misc.booking.introLabel')}
            hint={t('t10misc.booking.introHint')}
            name="intro"
            defaultValue={initial?.intro ?? ''}
            rows={3}
            maxLength={1000}
            placeholder={t('t10misc.booking.introPlaceholder')}
          />

          {state.error && (
            <div role="alert" className="flex items-start gap-2 bg-danger-bg border border-danger/30 text-danger text-xs font-medium rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}
          {state.ok && (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-ok bg-ok-bg border border-ok/30 rounded-xl px-4 py-2.5">
              <CheckCircle2 size={15} className="shrink-0" /> {t('t10misc.booking.saved')}
            </p>
          )}

          <Button
            variant="primary"
            type="submit"
            disabled={pending}
            className="w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? t('t10misc.booking.saving') : t('t10misc.booking.save')}
          </Button>
        </Card>
      </form>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
          <Link2 size={15} /> {t('t10misc.booking.shareTitle')}
        </h2>
        {initial ? (
          <>
            <p className="text-xs text-ink-2 mb-3">{t('t10misc.booking.shareDesc')}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code className="flex-1 min-h-[44px] flex items-center text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 break-all select-all text-ink">
                {publicUrl}
              </code>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="min-h-[44px] shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl border border-line bg-surface hover:bg-surface-2 text-ink"
                >
                  {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
                  {copied ? t('t10misc.booking.copied') : t('t10misc.booking.copy')}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-asphalt text-hero-ink hover:bg-graphite"
                >
                  <ExternalLink size={14} /> {t('t10misc.booking.open')}
                </a>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-ink-2 leading-relaxed">
            {t('t10misc.booking.shareUnsaved')}
          </p>
        )}
      </Card>
    </div>
  );
}
