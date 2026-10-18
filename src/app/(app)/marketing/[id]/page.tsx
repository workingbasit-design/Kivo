import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { getAudienceRecipients } from '@/app/actions/marketing';
import { type Audience } from '@/lib/marketing';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { formatDateShort } from '@/lib/utils';
import CampaignDetailClient from './CampaignDetailClient';
import { StatusPill } from '../../_components/status-ui';
import { PageTitle } from '../../_components/PageTitle';

export const metadata = { title: 'Campaign | EveryJob' };

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const { id } = await params;
  const locale: Locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId },
    include: { business: { select: { name: true, regionCode: true } } },
  });
  if (!campaign) notFound();

  const audienceLabel =
    campaign.audience === 'WITH_UNPAID'
      ? tr('t10misc.marketing.audienceUnpaid')
      : campaign.audience === 'RECENT_JOBS'
        ? tr('t10misc.marketing.audienceRecent')
        : tr('t10misc.marketing.audienceAll');

  const recipients = await getAudienceRecipients(businessId, campaign.audience as Audience);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> {tr('t10misc.marketing.backToMarketing')}
      </Link>

      <PageTitle
        title={campaign.name}
        summary={`${audienceLabel} · ${tr('t10misc.marketing.createdOn').replace('{date}', formatDateShort(campaign.createdAt, locale === 'fr' ? 'fr-CA' : 'en-CA'))}`}
      />
      <div className="flex flex-wrap gap-2">
        <StatusPill status={campaign.status} />
      </div>

      <Card className="p-6">
        <p className="text-[11px] font-bold text-ink-2 mb-1">{tr('t10misc.marketing.templateLabel')}</p>
        <p className="text-sm font-bold text-ink">{campaign.subject}</p>
        <p className="text-sm text-ink-2 mt-1.5 whitespace-pre-wrap">{campaign.body}</p>
        <p className="text-[11px] text-ink-2 mt-3">
          {tr('t10misc.marketing.templateNote').replace('{businessName}', campaign.business.name)}
        </p>
      </Card>

      <CampaignDetailClient
        locale={locale}
        campaign={{
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          body: campaign.body,
          status: campaign.status,
        }}
        recipients={recipients}
        businessName={campaign.business.name}
        regionCode={campaign.business.regionCode}
      />
    </div>
  );
}
