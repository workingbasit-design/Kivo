import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import type { LegalPage } from '@/lib/legal';

/** Shared renderer for the legal pages (privacy, terms, copyright). */
export default async function LegalLayout({ page }: { page: { en: LegalPage; fr: LegalPage } }) {
  const locale = await getLocale();
  const loc = locale === 'fr' ? page.fr : page.en;
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link href="/" className="text-sm font-semibold text-ink hover:underline">
          ← EveryJob
        </Link>
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-ink">{loc.title}</h1>
        <p className="mt-2 text-sm text-graphite">{loc.updated}</p>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-graphite">
          {loc.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-10 space-y-8">
          {loc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-bold text-ink">{s.heading}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-graphite">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-smoke flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/privacy" className="text-graphite hover:text-ink hover:underline">
            {locale === 'fr' ? 'Confidentialité' : 'Privacy'}
          </Link>
          <Link href="/terms" className="text-graphite hover:text-ink hover:underline">
            {locale === 'fr' ? 'Conditions' : 'Terms'}
          </Link>
          <Link href="/copyright" className="text-graphite hover:text-ink hover:underline">
            {locale === 'fr' ? 'Droit d\u2019auteur' : 'Copyright'}
          </Link>
        </div>
      </div>
    </div>
  );
}
