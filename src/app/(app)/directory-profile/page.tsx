import Link from 'next/link';
import { BadgeCheck, Clock3, EyeOff, ExternalLink, Store } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import {
  ensureClaimState,
  requestDirectoryClaim,
} from '@/app/actions/directory-profile';
import { parseServiceAreas } from '@/lib/directory-claim';
import DirectoryProfileForm from './profile-form';

export const metadata = { title: 'Directory listing | EveryJob' };
export const dynamic = 'force-dynamic';

/**
 * The business's public directory listing: claim/verification status plus
 * the editable public profile (services areas, hours display, contact
 * prefs — EN + FR). Tenant-scoped: a business only ever sees its own.
 */
export default async function DirectoryProfilePage() {
  const { businessId } = await requireAuth();
  await ensureClaimState(businessId);

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
        <PageHeader title="Directory listing" subtitle="Your public profile." />
        <Card>
          <EmptyState icon={<Store size={24} />} title="Business not found" description="Please sign in again." />
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
      <PageHeader
        title="Directory listing"
        subtitle="How customers find you on the EveryJob directory."
      />

      {/* Verification status */}
      <Card>
        <div className="flex items-start gap-3">
          {verified ? (
            <BadgeCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : pending ? (
            <Clock3 size={20} className="text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <EyeOff size={20} className="text-zinc-400 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            {verified ? (
              <>
                <p className="text-sm font-bold text-zinc-900">Your listing is live</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Customers can find {business.name} in the directory and send quote requests.
                </p>
                {page && (
                  <Link
                    href={`/p/${page.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline mt-2"
                  >
                    View public profile <ExternalLink size={12} />
                  </Link>
                )}
              </>
            ) : pending ? (
              <>
                <p className="text-sm font-bold text-zinc-900">Verification pending</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Your request was received and is waiting for review. Your listing stays
                  unpublished until it is approved — nothing is public yet.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-zinc-900">
                  {rejected ? 'Verification not approved' : 'Your listing is not public'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {rejected && claim?.note
                    ? `Reason: ${claim.note}`
                    : 'Request verification to publish your business in the EveryJob directory. ' +
                      'A reviewer checks every request by hand — listings never go live automatically.'}
                </p>
                <form action={requestDirectoryClaim} className="mt-3">
                  <button
                    type="submit"
                    className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-bold text-xs"
                  >
                    Request verification
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
    </div>
  );
}
