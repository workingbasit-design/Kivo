import { notFound } from 'next/navigation';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import EveryJobLogo from '@/components/EveryJobLogo';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

// Public page — no auth. This URL no longer accepts reviews (review moat):
// it explains that EveryJob reviews come only from verified customers via
// personal single-use links. Only the business name is ever shown here.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  return {
    title: business ? `Reviews · ${business.name} | EveryJob` : 'Reviews | EveryJob',
  };
}

export default async function PublicReviewInfoPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // Tenant-safe: only the business name is selected — nothing else leaks.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  if (!business) notFound();

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 w-fit">
            <EveryJobLogo size={44} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mt-1">
            {business.name}
          </h1>
        </div>

        <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-2">
            {L('t10money.reviewVerifiedOnlyTitle')}
          </h2>
          <p className="text-sm text-zinc-500">
            {L('t10money.reviewVerifiedOnlyBody').replace(
              '{business}',
              business.name
            )}
          </p>
          <p className="inline-flex items-center gap-1 mt-4 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <BadgeCheck size={12} />
            {L('t10money.reviewVerifiedBadge')}
          </p>
        </div>

        <p className="text-center text-[11px] text-zinc-400">
          {L('t10money.reviewPagePowered')}
        </p>
      </div>
    </div>
  );
}
