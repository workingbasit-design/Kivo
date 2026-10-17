import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { CA_PROVINCES } from '@/lib/tax';
import { ONBOARDING_TRADES } from '@/lib/validations';
import Logo from '@/components/Logo';
import OnboardingQuestions from '@/components/OnboardingQuestions';

export const metadata = { title: 'Get started | EveryJob' };

/**
 * E7 first run: three questions (trade, team size, province) that tailor
 * the setup checklist. Never forced: "Do later" skips and marks done.
 * Redirects to /dashboard when already completed (no loop).
 */
export default async function OnboardingPage() {
  const { businessId } = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { onboardingDone: true, trade: true, teamSize: true, taxRegion: true },
  });
  if (!business) throw new Error('Business not found.');
  if (business.onboardingDone) redirect('/dashboard');

  const locale: Locale = await getLocale();
  const tr = (path: Parameters<typeof t>[1]) => t(locale, path);

  const trades = ONBOARDING_TRADES.map((key) => ({
    key,
    label: t(locale, `credentials.trades.${key}` as Parameters<typeof t>[1]),
  }));

  return (
    <div className="min-h-screen bg-ej-bg flex flex-col">
      <nav className="px-6 py-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg" aria-label="EveryJob">
          <Logo size={32} />
        </Link>
      </nav>
      <div className="flex-1 flex items-start justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-ej-ink">
            {tr('support.firstRun.title')}
          </h1>
          <p className="text-sm text-ej-secondary mt-1 mb-6">
            {tr('support.firstRun.subtitle')}
          </p>
          <OnboardingQuestions
            locale={locale}
            trades={trades}
            provinces={CA_PROVINCES}
            initial={{
              trade: business.trade ?? '',
              teamSize: business.teamSize ?? '',
              province: business.taxRegion ?? '',
            }}
          />
        </div>
      </div>
      <p className="text-center text-xs text-ej-muted pb-6">Every job. One place.</p>
    </div>
  );
}
