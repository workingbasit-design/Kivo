// src/app/faq/page.tsx — Frequently asked questions.
//
// The FAQ lived on the old pro landing page at the root route. When the
// root became the exact customer-home reference build (2026-11-16), the
// FAQ moved here so the visible Q&A and its FAQPage JSON-LD stay wired
// together (the SEO test guards both). Copy is the bilingual homefaq
// fragment; the JSON-LD is built from the same visible FAQS (no drift).

import type { Metadata } from 'next';
import { getLocale } from '@/lib/i18n/server';
import { getCspNonce } from '@/lib/csp-nonce';
import { t } from '@/lib/i18n';
import { safeJsonLd } from '@/lib/jsonld';
import PublicHomeHeader from '@/components/public/PublicHomeHeader';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'meta.faqTitle'),
    description: t(locale, 'meta.faqDesc'),
  };
}

export default async function FaqPage() {
  const locale = await getLocale();
  const hf = (path: string) => t(locale, `homefaq.${path}` as never);
  const tr = (path: string) => t(locale, path as never);

  const FAQS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    q: hf(`q${n}`),
    a: hf(`a${n}`),
  }));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <main className="ej-home">
      <PublicHomeHeader locale={locale} active="none" />

      <script
        type="application/ld+json"
        nonce={await getCspNonce()}
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />

      <section id="faq" className="mx-auto w-[min(100%-9.6%,900px)] py-12">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-ink-2">
          {hf('eyebrow')}
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.025em] text-ink md:text-[52px]">
          {hf('title')}
        </h1>
        <p className="mt-4 text-[17px] text-ink-2">{hf('subtitle')}</p>

        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-line bg-surface px-6 py-1 transition-shadow open:shadow-kit-pop"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[17px] font-semibold tracking-[-0.01em] text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-asphalt text-[18px] font-light text-lime transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-6 text-[15.5px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
