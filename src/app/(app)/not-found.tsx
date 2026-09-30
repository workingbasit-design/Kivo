import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { getLocale } from '@/lib/i18n/server';

/**
 * Branded 404 for the authenticated app ((app) segment).
 * Rendered when notFound() is called — e.g. opening a job, customer,
 * quote or invoice that was deleted or never existed. Replaces the
 * generic Next.js 404 with a bilingual, on-brand message inside the
 * normal app shell.
 */
export default async function AppNotFound() {
  const locale = await getLocale();
  const fr = locale === 'fr';
  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      <div className="rounded-3xl border border-smoke bg-white p-8 text-center shadow-[0_16px_48px_-20px_rgba(0,0,0,0.15)]">
        <FileQuestion size={36} className="mx-auto text-zinc-300 mb-3" aria-hidden />
        <h1 className="text-lg font-bold text-ink">
          {fr ? 'Page introuvable' : 'Page not found'}
        </h1>
        <p className="text-sm text-graphite mt-2 leading-relaxed">
          {fr
            ? 'Cet élément a peut-être été supprimé, ou le lien est incorrect. Vérifiez l’adresse ou retournez au tableau de bord.'
            : 'This item may have been deleted, or the link is incorrect. Double-check the address or head back to your dashboard.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center mt-5 bg-ink text-white px-6 py-2.5 rounded-full text-[15px] font-medium hover:bg-graphite transition active:scale-95"
        >
          {fr ? '← Tableau de bord' : '← Dashboard'}
        </Link>
      </div>
    </main>
  );
}
