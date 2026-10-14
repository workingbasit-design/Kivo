'use client';

import { useState, useTransition } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { saveDigestSettings } from '@/app/actions/digest';
import { primaryBtnClass } from '@/components/ui';
import { TimeField } from '@/components/TimeField';

export function DigestSettingsForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: { enabled: boolean; sendTime: string; channels: string[] };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [sendTime, setSendTime] = useState(initial.sendTime);
  const [inApp, setInApp] = useState(initial.channels.includes('IN_APP'));
  const [push, setPush] = useState(initial.channels.includes('PUSH'));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const channels = [
        ...(inApp ? ['IN_APP'] : []),
        ...(push ? ['PUSH'] : []),
      ];
      const r = await saveDigestSettings(enabled, sendTime, channels);
      setMsg(r.ok ? t(locale, 'digest.saved') : (r.error ?? ''));
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
        <span className="text-sm font-semibold text-zinc-900">
          {t(locale, 'digest.enabled')}
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-6 h-6 accent-lime-600"
          aria-label={t(locale, 'digest.enabled')}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'digest.sendTime')}
          </span>
          <TimeField
            value={sendTime}
            onChange={setSendTime}
            locale={locale}
            disabled={!enabled}
            ariaLabel={t(locale, 'digest.sendTime')}
          />
        </label>
        <fieldset>
          <legend className="text-xs font-semibold text-zinc-600 block mb-1">
            {t(locale, 'digest.channels')}
          </legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-800 min-h-[44px]">
              <input
                type="checkbox"
                checked={inApp}
                onChange={(e) => setInApp(e.target.checked)}
                disabled={!enabled}
                className="w-5 h-5 accent-lime-600"
              />
              {t(locale, 'digest.channelInApp')}
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-800 min-h-[44px]">
              <input
                type="checkbox"
                checked={push}
                onChange={(e) => setPush(e.target.checked)}
                disabled={!enabled}
                className="w-5 h-5 accent-lime-600"
              />
              {t(locale, 'digest.channelPush')}
            </label>
          </div>
        </fieldset>
      </div>

      {msg && (
        <p className="text-sm text-emerald-700 font-medium" role="status">
          {msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={primaryBtnClass}
      >
        {pending ? '…' : t(locale, 'digest.save')}
      </button>
    </div>
  );
}
