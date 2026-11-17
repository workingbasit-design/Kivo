import { Suspense } from 'react';
import Link from 'next/link';
import PublicHomeHeader from '@/components/public/PublicHomeHeader';
import QuoteRequestForm from '@/components/QuoteRequestForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: t(locale, 'meta.requestTitle'),
    description: t(locale, 'meta.requestDesc'),
  };
}

export default async function QuoteRequestPage() {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  return (
    <div className="min-h-screen bg-paper font-sans">
      <PublicHomeHeader locale={locale} active="none" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Link
          href="/directory"
          className="inline-flex items-center min-h-[44px] text-xs text-ink-2 hover:text-ink"
        >
          ← {tr('t10misc.directory.backToDirectory')}
        </Link>
        <Suspense
          fallback={
            <div className="text-sm text-ink-2 text-center py-10" aria-live="polite">
              …
            </div>
          }
        >
          <QuoteRequestForm />
        </Suspense>
      </main>
    </div>
  );
}
