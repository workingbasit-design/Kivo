// src/app/how-it-works/page.tsx — homeowner "How It Works" page.
//
// The exact reference build links "How It Works" to /how-it-works, but
// the repo had no such route (the old landing page only had an anchor
// section for pros). This page makes that link real with the homeowner
// flow: search, request a quote, get it done. Copy is EN+FR via
// customer.howItWorks.*.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import PublicHomeHeader from '@/components/public/PublicHomeHeader';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'meta.howTitle'),
    description: t(locale, 'meta.howDesc'),
  };
}

const STEPS = [
  { n: '1', titleKey: 'step1Title', descKey: 'step1Desc' },
  { n: '2', titleKey: 'step2Title', descKey: 'step2Desc' },
  { n: '3', titleKey: 'step3Title', descKey: 'step3Desc' },
] as const;

export default async function HowItWorksPage() {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);

  return (
    <main className="ej-home">
      <PublicHomeHeader locale={locale} active="how" />

      <section className="mx-auto w-[min(100%-9.6%,1300px)] py-12">
        <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight text-ink">
          {tr('customer.howItWorks.title')}
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-2">
          {tr('customer.howItWorks.subtitle')}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-[24px] border border-line bg-surface p-8"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-hivis text-[20px] font-bold text-hivis-ink">
                {s.n}
              </span>
              <h2 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
                {tr(`customer.howItWorks.${s.titleKey}`)}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                {tr(`customer.howItWorks.${s.descKey}`)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-3">
          <Link
            href="/directory"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-hivis px-8 text-[16px] font-bold text-hivis-ink"
          >
            {tr('customer.howItWorks.cta')}
          </Link>
          <p className="text-[13px] text-ink-2">{tr('customer.howItWorks.note')}</p>
        </div>
      </section>
    </main>
  );
}
