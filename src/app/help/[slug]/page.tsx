import { notFound } from 'next/navigation';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import {
  getArticleBySlug,
  listArticles,
  categoryLabel,
  type HelpArticle,
} from '@/lib/help-articles';
import { Card } from '@/components/ui';

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal markdown-ish renderer: ## headings, - bullets, paragraphs.
 * All text is HTML-escaped first — article bodies are trusted data, but
 * escaping keeps the renderer safe by construction.
 */
function renderBody(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(
        `<h2 class="mt-6 mb-2 text-base font-bold text-zinc-900">${escapeHtml(line.slice(3))}</h2>`
      );
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push('<ul class="my-2 space-y-1.5 list-disc pl-5 text-sm text-zinc-700">');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line === '') {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    } else if (/^\d+\. /.test(line)) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(
        `<p class="my-1.5 text-sm text-zinc-700">${escapeHtml(line)}</p>`
      );
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<p class="my-2 text-sm leading-6 text-zinc-700">${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
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
      <a
        href="/help"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        ← {t(locale, 'support.backToHelp')}
      </a>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-lime-700">
        {categoryLabel(article.category, locale)}
      </div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        {loc.title}
      </h1>
      <Card className="mt-6">
        <div dangerouslySetInnerHTML={{ __html: renderBody(loc.body) }} />
        <p className="mt-6 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
          {t(locale, 'support.updatedNote')}
        </p>
      </Card>

      {related.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-bold text-zinc-900">
            {t(locale, 'support.relatedTitle')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => {
              const rl = locale === 'fr' ? r.fr : r.en;
              return (
                <a
                  key={r.slug}
                  href={`/help/${r.slug}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 hover:border-lime-500 hover:shadow-sm transition-shadow"
                >
                  <div className="font-semibold text-zinc-900">{rl.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
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
