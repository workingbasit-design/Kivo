import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import {
  getArticleBySlug,
  listArticles,
  categoryLabel,
  type HelpArticle,
} from '@/lib/help-articles';
import { Card } from '@/components/kit';
import { renderHelpBody } from '@/lib/help-render';

export async function generateStaticParams() {
  return listArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: 'Not found | EveryJob' };
  // Locale is cookie-based; metadata can't read it reliably here, so use EN.
  return { title: `${article.en.title} | EveryJob Help` };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article: HelpArticle | undefined = getArticleBySlug(slug);
  if (!article) notFound();
  const locale: Locale = await getLocale();
  const loc = locale === 'fr' ? article.fr : article.en;
  const related = article.related
    .map((s) => getArticleBySlug(s))
    .filter((a): a is HelpArticle => !!a);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/help"
        className="text-sm font-medium text-ink-2 hover:text-ink"
      >
        ← {t(locale, 'support.backToHelp')}
      </Link>
      <div className="mt-3 text-xs font-semibold text-ink">
        {categoryLabel(article.category, locale)}
      </div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {loc.title}
      </h1>
      <Card className="mt-6">
        <div dangerouslySetInnerHTML={{ __html: renderHelpBody(loc.body) }} />
        <p className="mt-6 border-t border-line pt-4 text-xs text-ink-2">
          {t(locale, 'support.updatedNote')}
        </p>
      </Card>

      {related.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-bold text-ink">
            {t(locale, 'support.relatedTitle')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => {
              const rl = locale === 'fr' ? r.fr : r.en;
              return (
                <a
                  key={r.slug}
                  href={`/help/${r.slug}`}
                  className="block rounded-2xl border border-line bg-surface p-4 hover:border-hivis hover:shadow-sm transition-shadow"
                >
                  <div className="font-semibold text-ink">{rl.title}</div>
                  <div className="mt-1 text-xs text-ink-2">
                    {categoryLabel(r.category, locale)}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
