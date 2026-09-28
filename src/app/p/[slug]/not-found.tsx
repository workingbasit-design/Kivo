import Link from 'next/link';
import { Store } from 'lucide-react';
import { getLocale } from '@/lib/i18n/server';
import { Card } from '@/components/ui';

/**
 * Friendly 404 for /p/[slug] (public directory profile) when the slug
 * doesn't exist or the business isn't listed in the directory.
 */
export default async function ProfileNotFound() {
  const locale = await getLocale();
  const fr = locale === 'fr';
  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="max-w-lg mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          <Store size={36} className="mx-auto text-zinc-300 mb-3" />
          <h1 className="text-lg font-bold text-zinc-900">
            {fr ? 'Profil d’entreprise introuvable' : 'Business profile not found'}
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            {fr
              ? 'Cette entreprise n’est pas inscrite au répertoire EveryJob ou son profil n’est plus disponible.'
              : 'This business isn’t listed in the EveryJob directory, or its profile is no longer available.'}
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
