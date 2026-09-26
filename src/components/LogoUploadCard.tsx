'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui';
import { t, type Locale } from '@/lib/i18n';
import { uploadBusinessLogo, removeBusinessLogo } from '@/app/actions/settings';

/**
 * Business logo upload card for Settings. The onboarding checklist points
 * here ("Upload your logo in Settings") — this is the UI that makes that
 * step actually work.
 */
export default function LogoUploadCard({
  locale,
  initialLogoUrl,
}: {
  locale: Locale;
  initialLogoUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('logo', file);
    const res = await uploadBusinessLogo(fd);
    setBusy(false);
    if (res.ok && res.logoUrl) {
      setLogoUrl(res.logoUrl);
      toast.success(t(locale, 't10misc.settings.logoSaved'));
    } else {
      toast.error(res.error ?? t(locale, 't10misc.settings.logoFailed'));
    }
  }

  async function onRemove() {
    setBusy(true);
    const res = await removeBusinessLogo();
    setBusy(false);
    if (res.ok) {
      setLogoUrl(null);
      toast.success(t(locale, 't10misc.settings.logoRemoved'));
    } else {
      toast.error(res.error ?? t(locale, 't10misc.settings.logoFailed'));
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-base font-bold text-zinc-900">
        {t(locale, 't10misc.settings.logoTitle')}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        {t(locale, 't10misc.settings.logoHint')}
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus size={28} className="text-zinc-300" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onPick}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {logoUrl
              ? t(locale, 't10misc.settings.logoReplace')
              : t(locale, 't10misc.settings.logoUpload')}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {t(locale, 't10misc.settings.logoRemove')}
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-400">
        {t(locale, 't10misc.settings.logoTypes')}
      </p>
    </Card>
  );
}
