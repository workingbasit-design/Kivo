import Link from 'next/link';
import { FileQuestion } from '@/components/icons';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

/**
 * Branded 404 for the authenticated app ((app) segment).
 * Rendered when notFound() is called - e.g. opening a job, customer,
 * quote or invoice that was deleted or never existed. Replaces the
 * generic Next.js 404 with a bilingual, on-brand message inside the
 * normal app shell.
 */
export default async function AppNotFound() {
  const locale = await getLocale();
  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      <div className="rounded-3xl border border-smoke bg-surface p-8 text-center shadow-[0_16px_48px_-20px_rgba(0,0,0,0.15)]">
        <FileQuestion size={36} className="mx-auto text-ink-2 mb-3" aria-hidden />
        <h1 className="text-lg font-bold text-ink">
          {t(locale, 'errors.pageNotFound.title')}
        </h1>
        <p className="text-sm text-graphite mt-2 leading-relaxed">
          {t(locale, 'errors.pageNotFound.body')}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center mt-5 bg-asphalt text-hero-ink px-6 py-2.5 rounded-full text-[15px] font-medium hover:bg-hero-2 transition active:scale-95"
        >
          {t(locale, 'errors.backToDashboard')}
        </Link>
      </div>
    </main>
  );
}
