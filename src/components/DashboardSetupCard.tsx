"use client";

import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import FinishSetupModal from './FinishSetupModal';
import { t, type Locale } from '@/lib/i18n';
import { primaryBtnClass } from '@/components/ui';

/** Locale for unmounted-but-shared client components: the `kivo-locale`
 *  cookie is the single source of truth (LanguageToggle writes it). */
function useCookieLocale(): Locale {
  const [locale] = useState<Locale>(() => {
    if (typeof document === 'undefined') return 'en';
    const m = document.cookie.match(/(?:^|;\s*)kivo-locale=(en|fr)/);
    return m ? (m[1] as Locale) : 'en';
  });
  return locale;
}

export default function DashboardSetupCard({ initialCompleted = false }: { initialCompleted?: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const locale = useCookieLocale();
  const T = (k: string) => t(locale, `t10work.${k}`);

  const steps = [
    { label: T('setupBusinessDetails'), done: true },
    { label: T('setupPriceBook'), done: true },
    { label: T('setupMessaging'), done: isCompleted },
    { label: T('setupAvailability'), done: isCompleted },
  ];

  return (
    <>
      <div className={`rounded-3xl p-6 border shadow-sm relative overflow-hidden transition-all ${
        isCompleted
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
          : 'bg-paper border-smoke'
      }`}>
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
              isCompleted ? 'text-emerald-700' : 'text-zinc-400'
            }`}>
              {isCompleted ? T('setupComplete') : T('setupReadyIn')}
            </p>
            <h2 className="text-lg font-bold text-zinc-900">
              {isCompleted ? T('setupTitleDone') : T('setupTitle')}
            </h2>
          </div>
          {isCompleted && (
            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm shrink-0">
              {T('setupActive')}
            </span>
          )}
        </div>

        <ul className="space-y-2 mb-6 relative z-10">
          {steps.map((s) => (
            <li key={s.label} className={`flex items-center gap-3 transition-opacity ${s.done ? '' : 'opacity-60'}`}>
              <span
                aria-hidden
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  s.done ? (isCompleted ? 'bg-emerald-600 text-white' : 'bg-ink text-lime') : 'border-2 border-zinc-300'
                }`}
              >
                {s.done && <CheckCircle2 size={12} />}
              </span>
              <span className={`text-sm ${s.done ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>

        {isCompleted ? (
          <div className="bg-white/80 p-3.5 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>{T('setupOperational')}</span>
          </div>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className={`${primaryBtnClass} w-full !text-sm relative z-10`}
          >
            {T('setupFinish')} <ArrowRight size={14} />
          </button>
        )}
      </div>

      <FinishSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCompleted={() => setIsCompleted(true)}
      />
    </>
  );
}
