/**
 * /agents - EveryJob's public AI-agent policy page.
 *
 * The stance: agents are welcome, through the documented protocol, with
 * the human always confirming before anything happens. This is the
 * alternative to blocking agents (Amazon) or letting them run wild.
 */
import Link from 'next/link';
import { ArrowRight, Bot, FileJson, MousePointerClick, Search, ShieldCheck, UserCheck } from '@/components/icons';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import Logo from '@/components/Logo';
import { Card } from '@/components/kit';
import { cn } from '@/lib/utils';

/**
 * Stagger — entrance-animation wrapper. The kit has no equivalent, so the
 * customer/ui implementation is inlined here (same `ej-anim-fade-up`
 * animation, same 60ms step capped at 8) to keep behaviour identical.
 */
function Stagger({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('ej-anim-fade-up', className)}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {children}
    </div>
  );
}

export default async function AgentsPage() {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never) as string;

  const steps = [
    { icon: Search, title: tr('agent.policy.step1Title'), body: tr('agent.policy.step1Body') },
    { icon: MousePointerClick, title: tr('agent.policy.step2Title'), body: tr('agent.policy.step2Body') },
    { icon: UserCheck, title: tr('agent.policy.step3Title'), body: tr('agent.policy.step3Body') },
  ];
  const rules = [1, 2, 3, 4, 5].map((n) => tr(`agent.policy.rule${n}`));

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line/70 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/" aria-label="EveryJob home">
            <Logo size={26} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        {/* Hero */}
        <Stagger index={0} className="pt-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">
            <Bot className="h-3.5 w-3.5" />
            {tr('agent.policy.badge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr('agent.policy.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-ink-2">
            {tr('agent.policy.subtitle')}
          </p>
        </Stagger>

        {/* How it works */}
        <Stagger index={1} className="mt-10">
          <h2 className="text-lg font-bold text-ink">{tr('agent.policy.howTitle')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={s.title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hivis text-hivis-ink shadow-md shadow-hivis/25">
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-semibold text-info">
                  {i + 1}
                </p>
                <h3 className="mt-1 font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
              </Card>
            ))}
          </div>
        </Stagger>

        {/* Manifest */}
        <Stagger index={2} className="mt-6">
          <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-asphalt text-hero-ink">
              <FileJson className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h3 className="font-bold text-ink">{tr('agent.policy.manifestTitle')}</h3>
              <p className="mt-1 text-sm text-ink-2">{tr('agent.policy.manifestBody')}</p>
              <code className="mt-2 inline-block rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink">
                /.well-known/everyjob.json
              </code>
            </div>
            <Link
              href="/.well-known/everyjob.json"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-hivis px-5 py-3 text-sm font-semibold text-hivis-ink shadow-lg shadow-hivis/25 transition-all duration-200 hover:bg-hivis hover:-translate-y-0.5"
            >
              {tr('agent.policy.manifestCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </Stagger>

        {/* Rules */}
        <Stagger index={3} className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ShieldCheck className="h-5 w-5 text-info" />
            {tr('agent.policy.rulesTitle')}
          </h2>
          <Card className="mt-4 divide-y divide-line p-2">
            {rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info-bg text-xs font-bold text-info">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink">{rule}</p>
              </div>
            ))}
          </Card>
        </Stagger>

        {/* For customers */}
        <Stagger index={4} className="mt-6">
          <Card className="border-line bg-info-bg/60 p-6">
            <h2 className="font-bold text-ink">{tr('agent.policy.customerTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{tr('agent.policy.customerBody')}</p>
            <Link
              href="/customer/profile"
              className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-surface px-5 py-3 text-sm font-semibold text-info shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {tr('agent.policy.customerCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </Stagger>
      </main>
    </div>
  );
}
