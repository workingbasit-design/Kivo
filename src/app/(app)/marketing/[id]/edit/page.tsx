import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import CampaignForm from '@/components/CampaignForm';
import type { Audience } from '@/lib/marketing';

export const metadata = { title: 'Edit campaign | Kivo' };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId },
    include: { business: { select: { name: true } } },
  });
  if (!campaign || campaign.status !== 'DRAFT') notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/marketing/${campaign.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to campaign
      </Link>
      <PageHeader title="Edit campaign" subtitle="Only draft campaigns can be edited." />
      <CampaignForm
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
