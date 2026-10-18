import { getLocale } from '@/lib/i18n/server';
import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import {
  HELP_CATEGORIES,
  articlesInCategory,
  categoryLabel,
  listArticles,
  searchArticles,
  type HelpArticle,
} from '@/lib/help-articles';
import SupportTicketForm from '@/components/SupportTicketForm';
import { Card } from '@/components/kit';

export const metadata = { title: 'Help center | EveryJob' };

function ArticleLink({ article, locale }: { article: HelpArticle; locale: Locale }) {
  const loc = locale === 'fr' ? article.fr : article.en;
  return (
    <a
      href={`/help/${article.slug}`}
      className="block rounded-2xl border border-line bg-surface p-4 hover:border-hivis hover:shadow-sm transition-shadow"
    >
      <div className="font-semibold text-ink">{loc.title}</div>
      <div className="mt-1 text-xs text-ink-2">
        {categoryLabel(article.category, locale)}
      </div>
    </a>
  );
}

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const locale: Locale = await getLocale();
  const { q = '', cat = '' } = await searchParams;
  const query = q.trim();
  const activeCat = HELP_CATEGORIES.some((c) => c.id === cat) ? cat : '';

  const results = query
    ? searchArticles(query, locale).filter((a) => !activeCat || a.category === activeCat)
    : activeCat
      ? articlesInCategory(activeCat as (typeof HELP_CATEGORIES)[number]['id'])
      : listArticles();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header data-kit="page-header" className="px-0 pb-[14px] pt-1.5">
        <h1 className="m-0 text-[28px] font-bold leading-[1.1] tracking-tight text-ink">
          {t(locale, 'support.helpTitle')}
        </h1>
        <p className="mb-0 mt-[5px] text-[16px] text-ink-2">{t(locale, 'support.helpSub')}</p>
      </header>

      <form method="GET" action="/help" className="mt-6 flex gap-2" role="search">
        <label htmlFor="help-search" className="sr-only">
          {t(locale, 'support.searchLabel')}
        </label>
        <input
          id="help-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t(locale, 'support.searchPh')}
          className="min-h-[44px] flex-1 rounded-xl border border-line-strong bg-surface px-4 text-sm text-ink placeholder:text-ink-2 focus:border-hivis focus:outline-none"
        />
        {activeCat ? <input type="hidden" name="cat" value={activeCat} /> : null}
        <button
          type="submit"
          className="min-h-[44px] rounded-xl bg-asphalt px-5 text-sm font-semibold text-hero-ink hover:bg-asphalt"
        >
          {t(locale, 'support.searchBtn')}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label={t(locale, 'support.categoriesLabel')}>
        <Link
          href="/help"
          className={`rounded-full px-4 py-2 text-sm font-medium min-h-[44px] inline-flex items-center ${
            !activeCat
              ? 'bg-asphalt text-hero-ink'
              : 'bg-surface-2 text-ink hover:bg-line'
          }`}
        >
          {t(locale, 'support.allLabel')}
        </Link>
        {HELP_CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={`/help?cat=${c.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
            className={`rounded-full px-4 py-2 text-sm font-medium min-h-[44px] inline-flex items-center ${
              activeCat === c.id
                ? 'bg-asphalt text-hero-ink'
                : 'bg-surface-2 text-ink hover:bg-line'
            }`}
          >
            {c[locale]}
          </Link>
        ))}
      </div>

      <div className="mt-8">
        {results.length === 0 ? (
          <Card>
            <p className="font-semibold text-ink">{t(locale, 'support.noResults')}</p>
            <p className="mt-1 text-sm text-ink-2">{t(locale, 'support.noResultsHint')}</p>
          </Card>
        ) : query || activeCat ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((a) => (
              <ArticleLink key={a.slug} article={a} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {HELP_CATEGORIES.map((c) => {
              const arts = articlesInCategory(c.id);
              if (arts.length === 0) return null;
              return (
                <section key={c.id} aria-label={c[locale]}>
                  <h2 className="mb-3 text-base font-bold text-ink">{c[locale]}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {arts.map((a) => (
                      <ArticleLink key={a.slug} article={a} locale={locale} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-12">
        <Card>
          <h2 className="text-lg font-bold text-ink">{t(locale, 'support.ticketTitle')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t(locale, 'support.ticketDesc')}</p>
          <div className="mt-4">
            <SupportTicketForm locale={locale} />
          </div>
        </Card>
      </div>
    </div>
  );
}
