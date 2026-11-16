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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const en = locale === 'en';
  return {
    title: en ? 'How It Works | EveryJob' : 'Comment ça marche | EveryJob',
    description: en
      ? 'Find a pro, get a quote, get it done. How EveryJob works for homeowners.'
      : 'Trouvez un pro, obtenez un devis, et c’est fait. Comment EveryJob fonctionne pour les propriétaires.',
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
      <header className="ej-home-header">
        <Link href="/" className="ej-home-brand" aria-label="EveryJob home">
          <span className="ej-home-brand-mark">
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
              <path d="M2 10 12 2l10 8" />
            </svg>
          </span>
          <span>EveryJob</span>
        </Link>
        <nav className="ej-home-nav" aria-label="Main navigation">
          <Link href="/directory">{tr('customer.publicHome.navFindPros')}</Link>
          <Link href="/register">{tr('customer.publicHome.navForPros')}</Link>
          <Link className="is-active" href="/how-it-works">
            {tr('customer.publicHome.navHowItWorks')}
          </Link>
        </nav>
        <div className="ej-home-header-actions">
          <Link className="ej-home-signin" href="/customer/login">
            {tr('customer.publicHome.signIn')}
          </Link>
          <Link className="ej-home-list-business" href="/register">
            {tr('customer.publicHome.listBusiness')}
          </Link>
        </div>
      </header>

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
