import Link from 'next/link';
import { CalendarX2 } from 'lucide-react';
import { getLocale } from '@/lib/i18n/server';
import { Card } from '@/components/ui';

/**
 * Friendly 404 for /book/[slug] when the slug doesn't exist or the
 * booking page is disabled. Keeps the 404 status code (set by notFound())
 * but shows a branded, bilingual message instead of the generic page.
 */
export default async function BookingNotFound() {
  const locale = await getLocale();
  const fr = locale === 'fr';
  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="max-w-lg mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          <CalendarX2 size={36} className="mx-auto text-zinc-300 mb-3" />
          <h1 className="text-lg font-bold text-zinc-900">
            {fr ? 'Page de réservation introuvable' : 'Booking page not found'}
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            {fr
              ? 'Ce lien de réservation n’existe pas ou n’est plus disponible. Vérifiez le lien ou contactez l’entreprise directement.'
              : 'This booking link doesn’t exist or is no longer available. Double-check the link or contact the business directly.'}
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
