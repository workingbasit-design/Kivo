import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { parseServiceAreas } from '@/lib/directory-claim';
import { ratingSummary } from '@/lib/directory';
import { buildShareCardText, isProfilePublic } from '@/lib/share-card';
import { setShareRating } from '@/app/actions/directory-profile';
import ShareCardButton from './share-card-button';

/**
 * Scroll lesson 3 — the pro's shareable card, on the directory-profile
 * page. The preview IS the share text (same builder output), so what the
 * pro sees is exactly what a recipient gets. The card links to the
 * directory profile and is only shareable once that profile actually
 * resolves publicly — no dead links are ever handed out.
 */
export default async function ShareCardSection({
  businessId,
}: {
  businessId: string;
}) {
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const [business, page, reviews] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, directoryOptIn: true, directoryVerifiedAt: true },
    }),
    prisma.bookingPage.findUnique({
      where: { businessId },
      select: {
        slug: true,
        enabled: true,
        headline: true,
        headlineFr: true,
        serviceAreas: true,
        shareRating: true,
      },
    }),
    prisma.review.findMany({
      where: { businessId },
      select: { rating: true },
    }),
  ]);

  if (!business) return null;

  const headline =
    locale === 'fr'
      ? (page?.headlineFr ?? page?.headline ?? null)
      : (page?.headline ?? null);
  const areas = parseServiceAreas(page?.serviceAreas);
  const { count, avg } = ratingSummary(reviews);
  const formattedAvg =
    avg === null
      ? null
      : locale === 'fr'
        ? avg.toFixed(1).replace('.', ',')
        : avg.toFixed(1);
  const { title, text } = buildShareCardText({
    businessName: business.name,
    headline,
    areas,
    rating: formattedAvg === null ? null : { avg: formattedAvg, count },
    includeRating: page?.shareRating ?? false,
    ratingOne: tr('t10misc.profile.shareRatingLineOne'),
    ratingMany: tr('t10misc.profile.shareRatingLineMany'),
  });

  const publicProfile =
    page !== null &&
    isProfilePublic({
      enabled: page.enabled,
      directoryOptIn: business.directoryOptIn,
      directoryVerifiedAt: business.directoryVerifiedAt,
    });

  return (
    <Card>
      <h2 className="text-sm font-bold text-ink">
        {tr('t10misc.profile.shareTitle')}
      </h2>
      <p className="text-xs text-ink-2 mt-1">{tr('t10misc.profile.shareDesc')}</p>

      {/* Preview — exactly the text a recipient gets. */}
      <div className="mt-3 rounded-[24px] border border-line/70 bg-surface dark:bg-coal p-4">
        {text.split('\n').map((line, i) => (
          <p key={i} className="text-sm text-ink first:font-bold">
            {line}
          </p>
        ))}
        {publicProfile && page && (
          <Link
            href={`/p/${page.slug}`}
            target="_blank"
            className="inline-block text-xs font-bold text-ink hover:underline mt-2"
          >
            /p/{page.slug}
          </Link>
        )}
      </div>

      {page ? (
        <form action={setShareRating} className="mt-3 space-y-2">
          <label className="flex items-start gap-2 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              name="shareRating"
              defaultChecked={page.shareRating}
              className="mt-0.5 w-5 h-5 accent-ink shrink-0"
            />
            <span className="font-bold">
              {tr('t10misc.profile.shareRatingLabel')}
            </span>
          </label>
          <p className="text-xs text-ink-2">
            {tr('t10misc.profile.shareRatingHint')}
          </p>
          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center bg-asphalt hover:bg-graphite text-hero-ink px-4 py-2.5 rounded-xl font-bold text-xs"
          >
            {tr('t10misc.profile.shareSave')}
          </button>
        </form>
      ) : (
        <p className="text-xs text-ink-2 mt-3">
          {tr('t10misc.profile.shareNoPage')}
        </p>
      )}

      <div className="mt-3">
        {publicProfile && page ? (
          <ShareCardButton
            title={title}
            text={text}
            path={`/p/${page.slug}`}
            shareLabel={tr('t10misc.profile.shareButton')}
            copiedLabel={tr('t10misc.profile.shareCopied')}
            copyManuallyLabel={tr('t10misc.profile.shareCopyManually')}
          />
        ) : (
          page && (
            <p className="text-xs text-ink-2">
              {tr('t10misc.profile.shareNotPublic')}
            </p>
          )
        )}
      </div>
    </Card>
  );
}
