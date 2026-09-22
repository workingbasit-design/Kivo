import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { getAudienceRecipients } from '@/app/actions/marketing';
import { AUDIENCE_LABELS, type Audience } from '@/lib/marketing';
import { formatDateShort } from '@/lib/utils';
import CampaignDetailClient from './CampaignDetailClient';

export const metadata = { title: 'Campaign | Kivo' };

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId },
    include: { business: { select: { name: true, regionCode: true } } },
  });
  if (!campaign) notFound();

  const recipients = await getAudienceRecipients(businessId, campaign.audience as Audience);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to marketing
      </Link>

      <PageHeader
        title={campaign.name}
        subtitle={`${AUDIENCE_LABELS[campaign.audience as Audience] ?? campaign.audience} · created ${formatDateShort(campaign.createdAt)}`}
        actions={<StatusBadge status={campaign.status} />}
      />

      <Card className="p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Message template</p>
        <p className="text-sm font-bold text-zinc-900">{campaign.subject}</p>
        <p className="text-sm text-zinc-600 mt-1.5 whitespace-pre-wrap">{campaign.body}</p>
        <p className="text-[11px] text-zinc-400 mt-3">
          {'{{name}}'} becomes each customer&apos;s name · {'{{business}}'} becomes{' '}
          {campaign.business.name}.
        </p>
      </Card>

      <CampaignDetailClient
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
