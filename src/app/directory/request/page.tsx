import { Suspense } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import QuoteRequestForm from '@/components/QuoteRequestForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export async function generateMetadata() {
  const locale = await getLocale();
  const en = locale === 'en';
  return {
    title: en ? 'Request free quotes | EveryJob Directory' : 'Demander des devis gratuits | Répertoire EveryJob',
    description: en
      ? 'Tell us what you need and your city — up to 5 matching local pros get your request. Free, no commission.'
      : 'Dites-nous ce dont vous avez besoin et votre ville — jusqu’à 5 pros locaux correspondants reçoivent votre demande. Gratuit, sans commission.',
  };
}

export default async function QuoteRequestPage() {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
  return (
    <div className="min-h-screen bg-paper font-sans">
      <header className="bg-ink text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href="/directory"
            className="inline-flex items-center min-h-[44px] text-xs text-white/60 hover:text-white"
          >
            ← {tr('t10misc.directory.backToDirectory')}
          </Link>
          <div className="flex items-center gap-3 mt-3">
            <Logo tone="onDark" size={30} />
            <span className="text-sm font-semibold text-white/60">{tr('t10misc.directory.title')}</span>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Suspense
          fallback={
            <div className="text-sm text-zinc-500 text-center py-10" aria-live="polite">
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
