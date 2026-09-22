import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import CampaignForm from '@/components/CampaignForm';

export const metadata = { title: 'New campaign | Kivo' };

export default async function NewCampaignPage() {
  const { businessId } = await requireAuth();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to marketing
      </Link>
      <PageHeader
        title="New campaign"
        subtitle="Draft a message for a group of customers. Nothing is sent automatically."
      />
      <CampaignForm businessName={business?.name ?? 'your business'} />
    </div>
  );
}
