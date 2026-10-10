import Link from 'next/link';
import { Search, Briefcase, ArrowRight } from 'lucide-react';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import EveryJobLogo from '@/components/EveryJobLogo';

export const metadata = {
  title: 'Get started — EveryJob',
  description:
    'Find a trusted local pro or run your home-service business with EveryJob.',
};

export default async function StartPage() {
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-[#f4f4f2] flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <EveryJobLogo size={36} />
        <span className="text-xl font-bold tracking-tight text-ink">EveryJob</span>
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink text-center mb-2">
        {t(locale, 'start.title') ?? 'How will you use EveryJob?'}
      </h1>
      <p className="text-zinc-600 text-center mb-10 max-w-md">
        {t(locale, 'start.subtitle') ??
          'Pick the experience built for you. You can always switch later.'}
      </p>

      <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {/* Customer / finder */}
        <Link
          href="/customer/login"
          className="group bg-ink text-white rounded-[24px] p-7 border border-white/10 shadow-[0_16px_40px_rgba(22,22,22,0.25)] hover:shadow-[0_20px_50px_rgba(22,22,22,0.35)] transition-shadow"
        >
          <div className="w-12 h-12 rounded-2xl bg-lime flex items-center justify-center mb-5">
            <Search size={24} className="text-ink" />
          </div>
          <h2 className="text-xl font-bold mb-1.5">
            {t(locale, 'start.customerTitle') ?? 'Find a pro'}
          </h2>
          <p className="text-sm text-white/60 mb-6 leading-relaxed">
            {t(locale, 'start.customerDesc') ??
              'Search trusted local pros, request quotes, and track your jobs.'}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime group-hover:gap-2.5 transition-all">
            {t(locale, 'start.customerCta') ?? 'Continue as customer'}
            <ArrowRight size={16} />
          </span>
        </Link>

        {/* Business / pro */}
        <Link
          href="/login"
          className="group bg-white rounded-[24px] p-7 border border-zinc-200/70 shadow-[0_16px_40px_rgba(22,22,22,0.08)] hover:shadow-[0_20px_50px_rgba(22,22,22,0.15)] transition-shadow"
        >
          <div className="w-12 h-12 rounded-2xl bg-ink flex items-center justify-center mb-5">
            <Briefcase size={24} className="text-lime" />
          </div>
          <h2 className="text-xl font-bold mb-1.5 text-ink">
            {t(locale, 'start.businessTitle') ?? 'For businesses'}
          </h2>
          <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
            {t(locale, 'start.businessDesc') ??
              'Jobs, scheduling, quotes, invoices, and payments — free for Canadian pros.'}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:gap-2.5 transition-all">
            {t(locale, 'start.businessCta') ?? 'Continue as business'}
            <ArrowRight size={16} />
          </span>
        </Link>
      </div>
    </div>
  );
}
