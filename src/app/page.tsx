import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import EveryJobLogo from '@/components/EveryJobLogo';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import Reveal from '@/components/home/Reveal';
import TradesMarquee from '@/components/home/TradesMarquee';
import ScheduleMock from '@/components/home/ScheduleMock';
import CopilotDemo from '@/components/home/CopilotDemo';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  CalendarClock,
  Check,
  FileText,
  Globe2,
  Languages,
  MapPin,
  PieChart,
  ReceiptText,
  Search,
  Share2,
  Sparkles,
  Tag,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'EveryJob — Every job. One place.',
  description:
    'EveryJob is a free field-service platform for service businesses: jobs, schedule, customers, quotes, invoices, payments, reminders and an AI assistant — all in one place. Free forever.',
};

const APPLE_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Segoe UI', sans-serif";

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <EveryJobLogo size={32} />
      <span className="text-[21px] font-semibold tracking-tight text-zinc-900">EveryJob</span>
    </span>
  );
}

export default async function LandingPage() {
  const locale = await getLocale();
  const h = (path: string) => t(locale, `home.${path}`);

  const NAV_LINKS = [
    { label: h('nav.features'), href: '#features' },
    { label: h('nav.aiCopilot'), href: '#copilot' },
    { label: h('nav.directory'), href: '/directory' },
  ];

  const TRADES = [
    h('trades.plumbers'),
    h('trades.electricians'),
    h('trades.acHeating'),
    h('trades.salons'),
    h('trades.pestControl'),
    h('trades.carpenters'),
    h('trades.painters'),
    h('trades.applianceRepair'),
  ];

  /** The 12 modules — icon + name grid, Apple-style hairline dividers. */
  const FEATURE_GRID = [
    { icon: Sparkles, key: 'copilot' },
    { icon: CalendarClock, key: 'schedule' },
    { icon: Briefcase, key: 'jobs' },
    { icon: Users, key: 'customers' },
    { icon: ReceiptText, key: 'quotes' },
    { icon: FileText, key: 'invoices' },
    { icon: Wallet, key: 'payments' },
    { icon: Share2, key: 'sharing' },
    { icon: Tag, key: 'priceBook' },
    { icon: Bell, key: 'reminders' },
    { icon: PieChart, key: 'reports' },
    { icon: UserCog, key: 'team' },
  ];

  /** Honest stats only — every number here is verifiably true. */
  const STATS = [
    { key: 'cost', value: h('stats.costValue') },
    { key: 'modules', value: h('stats.modulesValue') },
    { key: 'regions', value: h('stats.regionsValue') },
    { key: 'langs', value: h('stats.langsValue') },
  ];

  /** Local where it matters — built for Canada, province by province. */
  const CANADA_POINTS = [
    h('canada.point1'),
    h('canada.point2'),
    h('canada.point3'),
    h('canada.point4'),
    h('canada.point5'),
    h('canada.point6'),
  ];

  const STEPS = [
    { n: '1', icon: Users, key: 'step1' },
    { n: '2', icon: Calendar, key: 'step2' },
    { n: '3', icon: FileText, key: 'step3' },
  ];

  const heroDelay = (ms: number) => ({ '--ej-delay': `${ms}ms` }) as CSSProperties;

  return (
    <div
      className="landing-focus min-h-screen bg-white text-zinc-900 antialiased"
      style={{ fontFamily: APPLE_FONT }}
    >
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[68px]">
            <Link href="/" aria-label="EveryJob home" className="rounded-lg">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-[15px] text-zinc-600 hover:text-zinc-900 transition-colors rounded"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-[15px] text-zinc-600 hover:text-zinc-900 transition-colors px-4 py-2 rounded-full"
              >
                {h('nav.login')}
              </Link>
              <Link
                href="/register"
                className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[15px] font-medium hover:bg-zinc-700 transition active:scale-95 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
              >
                {h('nav.signUp')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — Apple-style statement headline, staggered entrance */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-48 left-1/2 -translate-x-1/2 h-[520px] w-[880px] rounded-full bg-[#6329d4]/[0.09] blur-3xl" />
            <div className="absolute top-48 -left-48 h-[340px] w-[340px] rounded-full bg-[#a78bfa]/[0.12] blur-3xl" />
            <div className="absolute top-72 -right-48 h-[340px] w-[340px] rounded-full bg-[#6329d4]/[0.07] blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
            <p
              className="ej-hero-anim inline-flex items-center gap-2 text-[13px] font-medium text-zinc-500 border border-zinc-200 bg-white/70 backdrop-blur rounded-full px-4 py-1.5 mb-8"
              style={heroDelay(0)}
            >
              <Sparkles size={14} className="text-[#6329d4]" />
              {h('hero.badge')}
            </p>
            <h1
              className="ej-hero-anim text-[44px] leading-[1.04] sm:text-6xl md:text-7xl lg:text-[84px] font-bold tracking-[-0.03em] mb-6"
              style={heroDelay(110)}
            >
              {h('hero.title1')}
              <br />
              <span className="bg-gradient-to-b from-[#6329d4] via-[#7c3aed] to-[#a855f7] bg-clip-text text-transparent">
                {h('hero.title2')}
              </span>
            </h1>
            <p
              className="ej-hero-anim text-lg md:text-[21px] leading-relaxed text-zinc-600 mb-10 max-w-2xl mx-auto"
              style={heroDelay(220)}
            >
              {h('hero.subtitle')}
            </p>
            <div
              className="ej-hero-anim flex flex-col sm:flex-row gap-3 justify-center mb-6"
              style={heroDelay(320)}
            >
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 bg-[#6329d4] text-white px-8 py-3.5 rounded-full text-[17px] font-medium hover:bg-[#5221b3] transition active:scale-95 shadow-[0_16px_40px_-12px_rgba(99,41,212,0.55)]"
              >
                {h('hero.ctaStart')}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 text-[#6329d4] px-8 py-3.5 rounded-full text-[17px] font-medium hover:underline underline-offset-4"
              >
                {h('hero.ctaSee')}
              </Link>
            </div>
            <p className="ej-hero-anim text-[13px] text-zinc-400" style={heroDelay(420)}>
              {h('hero.reassure')}
            </p>
          </div>

          {/* Product visual — animated stylized mock of the real app */}
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
            <Reveal delay={150}>
              <ScheduleMock
                strings={{
                  title: h('mock.title'),
                  jobs: [1, 2, 3].map((n) => ({
                    name: h(`mock.job${n}Name`),
                    service: h(`mock.job${n}Service`),
                    time: h(`mock.job${n}Time`),
                    amt: h(`mock.job${n}Amt`),
                    status: h(`mock.job${n}Status`),
                  })),
                  footerBefore: h('mock.footerBefore'),
                  footerInv: h('mock.footerInv'),
                  footerAfter: h('mock.footerAfter'),
                }}
              />
            </Reveal>
          </div>
        </section>

        {/* Trades marquee */}
        <section className="border-y border-zinc-100 py-7">
          <TradesMarquee trades={TRADES} label={h('trades.label')} />
        </section>

        {/* Feature grid — hairline dividers, Apple style */}
        <section id="features" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-4xl md:text-[56px] leading-[1.05] font-bold tracking-[-0.025em] mb-4">
                {h('features.title1')}
                <br />
                <span className="text-zinc-400">{h('features.title2')}</span>
              </h2>
              <p className="text-lg md:text-[19px] text-zinc-600">{h('features.subtitle')}</p>
            </Reveal>
            <Reveal delay={120}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-zinc-200/80 border border-zinc-200/80 rounded-[28px] overflow-hidden">
                {FEATURE_GRID.map((f) => (
                  <div
                    key={f.key}
                    className="group bg-white p-6 md:p-7 flex flex-col items-center text-center gap-3 hover:bg-[#6329d4]/[0.045] transition-colors"
                  >
                    <f.icon
                      size={26}
                      strokeWidth={1.5}
                      className="text-zinc-800 transition-all duration-300 group-hover:text-[#6329d4] group-hover:scale-110"
                    />
                    <span className="text-[13px] font-medium text-zinc-600 group-hover:text-zinc-900 transition-colors">
                      {h(`features.${f.key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* AI Copilot — dark section */}
        <section id="copilot" className="relative py-20 md:py-28 bg-zinc-950 text-white scroll-mt-16 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/4 h-[380px] w-[520px] rounded-full bg-[#6329d4]/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-[280px] w-[380px] rounded-full bg-[#a855f7]/[0.12] blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Chat mock — messages stagger in on scroll */}
              <div className="order-2 lg:order-1">
                <Reveal>
                  <CopilotDemo
                    strings={{
                      chatTitle: h('copilot.chatTitle'),
                      langBadge: h('copilot.langBadge'),
                      msg1: h('copilot.msg1'),
                      msg2: h('copilot.msg2'),
                      msg3: h('copilot.msg3'),
                      msg4Title: h('copilot.msg4Title'),
                      msg4Detail: h('copilot.msg4Detail'),
                      inputLabel: h('copilot.inputLabel'),
                      inputHint: h('copilot.inputHint'),
                    }}
                  />
                </Reveal>
              </div>
              {/* Copy */}
              <div className="order-1 lg:order-2">
                <Reveal>
                  <p className="text-[13px] font-semibold tracking-[0.18em] text-[#a78bfa] uppercase mb-5">
                    {h('copilot.eyebrow')}
                  </p>
                  <h2 className="text-4xl md:text-[56px] leading-[1.05] font-bold tracking-[-0.025em] mb-6">
                    {h('copilot.title1')}
                    <br />
                    {h('copilot.title2')}
                  </h2>
                  <p className="text-lg md:text-[19px] text-white/55 mb-8 leading-relaxed max-w-lg">
                    {h('copilot.subtitle')}
                  </p>
                </Reveal>
                <ul className="space-y-4 mb-10">
                  {[1, 2, 3].map((n) => (
                    <Reveal as="li" key={n} delay={n * 90} className="flex items-start gap-3 text-white/75 text-[15px]">
                      <span className="w-5 h-5 rounded-full bg-[#6329d4] flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} className="text-white" />
                      </span>
                      {h(`copilot.bullet${n}`)}
                    </Reveal>
                  ))}
                </ul>
                <Reveal delay={300}>
                  <Link
                    href="/register"
                    className="group inline-flex items-center gap-2 text-[#a78bfa] font-medium text-[17px] hover:text-white transition-colors"
                  >
                    {h('copilot.cta')}
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* Honest stats — Apple rhythm, true numbers only */}
        <section className="py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center mb-14">
              <h2 className="text-4xl md:text-[56px] leading-[1.05] font-bold tracking-[-0.025em]">
                {h('stats.title1')}
                <br />
                <span className="text-zinc-400">{h('stats.title2')}</span>
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8">
              {STATS.map((s, i) => (
                <Reveal key={s.key} delay={i * 90} className="text-center lg:text-left">
                  <p className="text-[12px] font-semibold tracking-[0.16em] text-[#6329d4] uppercase mb-2">
                    {h(`stats.${s.key}Label`)}
                  </p>
                  <p className="text-5xl md:text-6xl font-bold tracking-[-0.03em] mb-3">{s.value}</p>
                  <p className="text-[14px] text-zinc-500 leading-relaxed max-w-[220px] mx-auto lg:mx-0">
                    {h(`stats.${s.key}Desc`)}
                  </p>
                </Reveal>
              ))}
            </div>
            <Reveal className="text-center mt-14">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-8 py-3.5 rounded-full text-[17px] font-medium hover:bg-zinc-700 transition active:scale-95 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)]"
              >
                {h('stats.cta')}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 md:py-28 bg-zinc-50 border-y border-zinc-100 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-4xl md:text-[52px] leading-[1.05] font-bold tracking-[-0.025em] mb-4">
                {h('steps.title1')}
                <br />
                <span className="text-zinc-400">{h('steps.title2')}</span>
              </h2>
              <p className="text-lg text-zinc-600">{h('steps.subtitle')}</p>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-5">
              {STEPS.map((s, i) => (
                <Reveal
                  key={s.n}
                  delay={i * 110}
                  className="relative bg-white rounded-[24px] border border-zinc-200/80 p-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_56px_-20px_rgba(0,0,0,0.18)] hover:border-zinc-300"
                >
                  <span className="absolute top-6 right-7 text-[64px] leading-none font-bold text-zinc-100 select-none">
                    {s.n}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-5">
                    <s.icon size={22} strokeWidth={1.6} />
                  </div>
                  <h3 className="text-[19px] font-semibold tracking-tight text-zinc-900 mb-2">
                    {h(`steps.${s.key}Title`)}
                  </h3>
                  <p className="text-[15px] text-zinc-600 leading-relaxed">{h(`steps.${s.key}Desc`)}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Local where it matters — built for Canada */}
        <section id="regions" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-[13px] font-semibold tracking-[0.18em] text-[#6329d4] uppercase mb-5 flex items-center justify-center gap-2">
                <Globe2 size={15} /> {h('canada.eyebrow')}
              </p>
              <h2 className="text-4xl md:text-[52px] leading-[1.05] font-bold tracking-[-0.025em] mb-4">
                {h('canada.title1')}
                <br />
                <span className="text-zinc-400">{h('canada.title2')}</span>
              </h2>
              <p className="text-lg text-zinc-600">{h('canada.subtitle')}</p>
            </Reveal>
            <div className="max-w-4xl mx-auto">
              <Reveal delay={120}>
                <div className="bg-white rounded-[24px] border border-zinc-200/80 p-8 transition-shadow duration-300 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.12)]">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center">
                      <MapPin size={22} strokeWidth={1.6} />
                    </div>
                    <h3 className="text-[22px] font-semibold tracking-tight text-zinc-900">
                      {h('canada.cardTitle')}
                    </h3>
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                    {CANADA_POINTS.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-[15px] text-zinc-600">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={12} className="text-emerald-700" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
            <Reveal delay={200}>
              <p className="text-center text-[14px] text-zinc-400 mt-10 flex items-center justify-center gap-2">
                <Languages size={15} /> {h('canada.footnote')}
              </p>
            </Reveal>
          </div>
        </section>

        {/* Directory teaser */}
        <section id="directory" className="pb-20 md:pb-28 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="grid lg:grid-cols-2 gap-10 items-center bg-zinc-50 rounded-[32px] border border-zinc-200/70 p-8 md:p-14">
                <div>
                  <p className="text-[13px] font-semibold tracking-[0.18em] text-[#6329d4] uppercase mb-5">
                    {h('directory.eyebrow')}
                  </p>
                  <h2 className="text-3xl md:text-[40px] leading-[1.08] font-bold tracking-[-0.02em] mb-4">
                    {h('directory.title')}
                  </h2>
                  <p className="text-[17px] text-zinc-600 mb-8 leading-relaxed">
                    {h('directory.subtitle')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/directory"
                      className="group inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-full text-[15px] font-medium hover:bg-zinc-700 transition active:scale-95"
                    >
                      {h('directory.ctaExplore')}
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center gap-2 text-[#6329d4] px-6 py-3 rounded-full text-[15px] font-medium hover:underline underline-offset-4"
                    >
                      {h('directory.ctaList')}
                    </Link>
                  </div>
                </div>
                <div className="bg-white rounded-[24px] border border-zinc-200 p-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-4">
                    {h('directory.cardTitle')}
                  </p>
                  <div className="space-y-3 text-[14px]">
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <Search size={18} className="text-zinc-700 shrink-0" />
                      <p className="text-zinc-600">
                        {h('directory.card1Pre')}
                        <span className="font-semibold text-zinc-900">{h('directory.card1Bold')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <Users size={18} className="text-zinc-700 shrink-0" />
                      <p className="text-zinc-600">
                        {h('directory.card2Pre')}
                        <span className="font-semibold text-zinc-900">{h('directory.card2Bold')}</span>
                        {h('directory.card2Post')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#6329d4]/[0.06] border border-[#6329d4]/20">
                      <Bell size={18} className="text-[#6329d4] shrink-0" />
                      <p className="text-zinc-600">
                        {h('directory.card3Pre')}
                        <span className="font-semibold text-zinc-900">{h('directory.card3Bold')}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative pb-24 md:pb-32 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[700px] rounded-full bg-[#6329d4]/[0.08] blur-3xl" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <Reveal>
              <h2 className="text-4xl md:text-[52px] leading-[1.05] font-bold tracking-[-0.025em] mb-6">
                {h('finalCta.title1')}
                <br />
                <span className="bg-gradient-to-b from-[#6329d4] via-[#7c3aed] to-[#a855f7] bg-clip-text text-transparent">
                  {h('finalCta.title2')}
                </span>
              </h2>
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 bg-[#6329d4] text-white px-9 py-4 rounded-full text-[17px] font-medium hover:bg-[#5221b3] transition active:scale-95 shadow-[0_16px_40px_-12px_rgba(99,41,212,0.55)]"
              >
                {h('finalCta.cta')}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="text-[13px] text-zinc-400 mt-5">{h('finalCta.note')}</p>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link href="/" aria-label="EveryJob home" className="rounded-lg">
              <Logo />
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
              <Link href="/login" className="text-[14px] text-zinc-500 hover:text-zinc-900 transition-colors">
                {h('footer.login')}
              </Link>
              <Link href="/register" className="text-[14px] text-zinc-500 hover:text-zinc-900 transition-colors">
                {h('footer.createAccount')}
              </Link>
              <Link href="/directory" className="text-[14px] text-zinc-500 hover:text-zinc-900 transition-colors">
                {h('footer.directory')}
              </Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
            <p className="text-[14px] text-zinc-500">
              &copy; {new Date().getFullYear()} {h('footer.rightsSuffix')}
            </p>
            <p className="text-[13px] text-zinc-400 mt-1">{h('footer.madeFor')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
