import Link from 'next/link';
import { Store } from '@/components/icons';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Card } from '@/components/kit';

/**
 * Friendly 404 for /p/[slug] (public directory profile) when the slug
 * doesn't exist or the business isn't listed in the directory.
 */
export default async function ProfileNotFound() {
  const locale = await getLocale();
  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="max-w-lg mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          <Store size={36} className="mx-auto text-ink-2 mb-3" />
          <h1 className="text-lg font-bold text-ink">
            {t(locale, 'errors.profileNotFound.title')}
          </h1>
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">
            {t(locale, 'errors.profileNotFound.body')}
          </p>
          <Link
            href="/"
            className="inline-block mt-5 text-sm font-semibold text-ink underline underline-offset-2"
          >
            ← EveryJob
          </Link>
        </Card>
      </main>
    </div>
  );
}
