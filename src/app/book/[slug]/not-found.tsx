import Link from 'next/link';
import { CalendarX2 } from '@/components/icons';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Card } from '@/components/kit';

/**
 * Friendly 404 for /book/[slug] when the slug doesn't exist or the
 * booking page is disabled. Keeps the 404 status code (set by notFound())
 * but shows a branded, bilingual message instead of the generic page.
 */
export default async function BookingNotFound() {
  const locale = await getLocale();
  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="max-w-lg mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          <CalendarX2 size={36} className="mx-auto text-ink-2 mb-3" />
          <h1 className="text-lg font-bold text-ink">
            {t(locale, 'errors.bookingNotFound.title')}
          </h1>
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">
            {t(locale, 'errors.bookingNotFound.body')}
          </p>
          <Link
            href="/"
            className="inline-block mt-5 text-sm font-semibold text-ink hover:underline"
          >
            ← EveryJob
          </Link>
        </Card>
      </main>
    </div>
  );
}
