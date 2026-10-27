import Link from 'next/link';
import { BadgeCheck, Clock3, EyeOff, ExternalLink, Store } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import {
  ensureClaimState,
  requestDirectoryClaim,
} from '@/app/actions/directory-profile';
import { parseServiceAreas } from '@/lib/directory-claim';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import DirectoryProfileForm from './profile-form';
import ShareCardSection from './share-card-section';
import { PageTitle } from '../_components/PageTitle';
import { EmptyState } from '@/components/kit';

export const metadata = { title: 'Directory listing | EveryJob' };
export const dynamic = 'force-dynamic';

/**
 * The business's public directory listing: claim/verification status plus
 * the editable public profile (services areas, hours display, contact
 * prefs - EN + FR). Tenant-scoped: a business only ever sees its own.
 */
export default async function DirectoryProfilePage() {
  const { businessId } = await requireAuth();
  await ensureClaimState(businessId);

  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const [business, page, claim] = await Promise.all([
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
        intro: true,
        introFr: true,
        description: true,
        descriptionFr: true,
        serviceAreas: true,
        showPhone: true,
      },
    }),
    prisma.directoryClaim.findUnique({ where: { businessId } }),
  ]);

  if (!business) {
    return (
      <div className="space-y-6">
        <PageTitle title={tr('t10misc.profile.title')} summary={tr('t10misc.profile.subtitle')} />
        <Card>
          <EmptyState
            icon={<Store />}
            title={tr('t10misc.profile.notFoundTitle')}
            text={tr('t10misc.profile.notFoundDesc')}
          />
        </Card>
      </div>
    );
  }

  const verified = !!business.directoryVerifiedAt;
  const pending = claim?.status === 'PENDING';
  const rejected = claim?.status === 'REJECTED';
  const areas = parseServiceAreas(page?.serviceAreas);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageTitle title={tr('t10misc.profile.title')} summary={tr('t10misc.profile.subtitle')} />

      {/* Verification status */}
      <Card>
        <div className="flex items-start gap-3">
          {verified ? (
            <BadgeCheck size={20} className="text-ok shrink-0 mt-0.5" />
          ) : pending ? (
            <Clock3 size={20} className="text-warn-text shrink-0 mt-0.5" />
          ) : (
            <EyeOff size={20} className="text-ink-2 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            {verified ? (
              <>
                <p className="text-sm font-bold text-ink">{tr('t10misc.profile.liveTitle')}</p>
                <p className="text-xs text-ink-2 mt-1">
                  {tr('t10misc.profile.liveDesc').replace('{name}', business.name)}
                </p>
                {page && (
                  <Link
                    href={`/p/${page.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 min-h-[44px] text-xs font-bold text-ink hover:underline mt-1 px-1 -ml-1"
                  >
                    {tr('t10misc.profile.viewPublic')} <ExternalLink size={12} />
                  </Link>
                )}
              </>
            ) : pending ? (
              <>
                <p className="text-sm font-bold text-ink">{tr('t10misc.profile.pendingTitle')}</p>
                <p className="text-xs text-ink-2 mt-1">{tr('t10misc.profile.pendingDesc')}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-ink">
                  {rejected ? tr('t10misc.profile.rejectedTitle') : tr('t10misc.profile.notPublicTitle')}
                </p>
                <p className="text-xs text-ink-2 mt-1">
                  {rejected && claim?.note
                    ? `${tr('t10misc.profile.reason')}: ${claim.note}`
                    : tr('t10misc.profile.requestDesc')}
                </p>
                <form action={requestDirectoryClaim} className="mt-3">
                  <button
                    type="submit"
                    className="min-h-[44px] inline-flex items-center bg-asphalt hover:bg-graphite text-hero-ink px-4 py-2.5 rounded-xl font-bold text-xs"
                  >
                    {tr('t10misc.profile.requestButton')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Public profile editor */}
      <DirectoryProfileForm
        initial={{
          headline: page?.headline ?? '',
          headlineFr: page?.headlineFr ?? '',
          intro: page?.intro ?? '',
          introFr: page?.introFr ?? '',
          description: page?.description ?? '',
          descriptionFr: page?.descriptionFr ?? '',
          serviceAreas: areas.join(', '),
          showPhone: page?.showPhone ?? true,
          enabled: page?.enabled ?? true,
        }}
      />

      {/* Shareable pro card (Scroll lesson 3) */}
      <ShareCardSection businessId={businessId} />
    </div>
  );
}
