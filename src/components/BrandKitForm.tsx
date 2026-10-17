'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { saveBrandKit } from '@/app/actions/brand';
import { inputClass, primaryBtnClass } from '@/components/ui';

const PRESETS = [
  { name: 'Lime', primary: '#3f6212', accent: '#a3e635' },
  { name: 'Ocean', primary: '#0c4a6e', accent: '#38bdf8' },
  { name: 'Sunset', primary: '#7c2d12', accent: '#fb923c' },
  { name: 'Royal', primary: '#4c1d95', accent: '#c084fc' },
  { name: 'Forest', primary: '#14532d', accent: '#4ade80' },
  { name: 'Berry', primary: '#831843', accent: '#f472b6' },
];

export function BrandKitForm({
  locale,
  initial,
}: {
  locale: Locale;
  initial: {
    tagline: string;
    primary: string;
    accent: string;
    services: string[];
  };
}) {
  const [tagline, setTagline] = useState(initial.tagline);
  const [primary, setPrimary] = useState(initial.primary);
  const [accent, setAccent] = useState(initial.accent);
  const [services, setServices] = useState<string[]>(initial.services);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const addService = () => {
    const v = draft.trim();
    if (v && services.length < 10 && !services.includes(v)) {
      setServices([...services, v]);
    }
    setDraft('');
  };

  const removeService = (s: string) => setServices(services.filter((x) => x !== s));

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await saveBrandKit(tagline, primary, accent, services);
      setMsg(r.ok ? t(locale, 'brand.saved') : (r.error ?? ''));
    });
  };

  const tr = (k: string) => t(locale, k);

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="brand-tagline" className="block text-sm font-semibold text-ink mb-1.5">
          {tr('brand.tagline')}
        </label>
        <input
          id="brand-tagline"
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder={tr('brand.taglinePlaceholder')}
          maxLength={140}
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-ink mb-2">
          {tr('brand.primary')}
        </legend>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { setPrimary(p.primary); setAccent(p.accent); }}
              aria-label={p.name}
              aria-pressed={primary === p.primary && accent === p.accent}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border-2 transition-transform ${
                primary === p.primary && accent === p.accent
                  ? 'border-zinc-900 scale-105'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ background: `linear-gradient(135deg, ${p.primary} 50%, ${p.accent} 50%)` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-2 block mb-1">
              {tr('brand.custom')} - {tr('brand.primary')}
            </span>
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line cursor-pointer bg-surface px-1"
              aria-label={tr('brand.primary')}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-2 block mb-1">
              {tr('brand.custom')} - {tr('brand.accent')}
            </span>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-xl border border-line cursor-pointer bg-surface px-1"
              aria-label={tr('brand.accent')}
            />
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="brand-service" className="block text-sm font-semibold text-ink mb-1">
          {tr('brand.services')}
        </label>
        <p className="text-xs text-ink-2 mb-2">{tr('brand.servicesDesc')}</p>
        <div className="flex gap-2">
          <input
            id="brand-service"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
            placeholder={tr('brand.servicePlaceholder')}
            maxLength={60}
            className={inputClass}
          />
          <button
            type="button"
            onClick={addService}
            disabled={!draft.trim() || services.length >= 10}
            className="shrink-0 min-w-[44px] min-h-[44px] px-4 rounded-xl bg-asphalt text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Plus size={16} aria-hidden /> {tr('brand.add')}
          </button>
        </div>
        {services.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {services.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: primary }}
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeService(s)}
                  aria-label={`${tr('brand.remove')}: ${s}`}
                  className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-full bg-asphalt/20 hover:bg-asphalt/40 inline-flex items-center justify-center"
                >
                  <X size={14} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {msg && (
        <p className="text-sm text-ok font-medium" role="status">
          {msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={`${primaryBtnClass} min-h-[44px]`}
      >
        {pending ? '…' : tr('brand.save')}
      </button>
    </div>
  );
}
