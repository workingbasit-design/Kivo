import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import CampaignForm from '@/components/CampaignForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import type { Audience } from '@/lib/marketing';
import { PageTitle } from '../../../_components/PageTitle';

export const metadata = { title: 'Edit campaign | EveryJob' };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const { id } = await params;
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId },
    include: { business: { select: { name: true } } },
  });
  if (!campaign || campaign.status !== 'DRAFT') notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/marketing/${campaign.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> {tr('t10misc.marketing.backToCampaign')}
      </Link>
      <PageTitle
        title={tr('t10misc.marketing.editPageTitle')}
        summary={tr('t10misc.marketing.editPageSubtitle')}
      />
      <CampaignForm
        locale={locale}
        businessName={campaign.business.name}
        initial={{
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          body: campaign.body,
          audience: campaign.audience as Audience,
        }}
      />
    </div>
  );
}
