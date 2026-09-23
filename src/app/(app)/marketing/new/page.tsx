import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import CampaignForm from '@/components/CampaignForm';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export const metadata = { title: 'New campaign | EveryJob' };

export default async function NewCampaignPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);
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
        <ArrowLeft size={14} /> {tr('t10misc.marketing.backToMarketing')}
      </Link>
      <PageHeader
        title={tr('t10misc.marketing.newPageTitle')}
        subtitle={tr('t10misc.marketing.newPageSubtitle')}
      />
      <CampaignForm businessName={business?.name ?? 'your business'} locale={locale} />
    </div>
  );
}
