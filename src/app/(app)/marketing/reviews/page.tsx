import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import ReviewRequestsClient from '@/components/ReviewRequestsClient';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export const metadata = { title: 'Review requests | EveryJob' };

export default async function ReviewRequestsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [jobs, reviewed] = await Promise.all([
    prisma.job.findMany({
      where: { businessId, status: 'COMPLETED', date: { gte: since } },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        title: true,
        date: true,
        customerId: true,
        customer: { select: { name: true, phone: true } },
      },
    }),
    prisma.review.findMany({
      where: { businessId, customerId: { not: null } },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
  ]);

  const reviewedIds = new Set(reviewed.map((r) => r.customerId as string));

  // One row per customer: the most recent completed job from a customer with no review yet.
  const seen = new Set<string>();
  const rows = [];
  for (const j of jobs) {
    if (reviewedIds.has(j.customerId) || seen.has(j.customerId)) continue;
    seen.add(j.customerId);
    rows.push({
      jobId: j.id,
      jobTitle: j.title,
      jobDate: j.date.toISOString(),
      customerId: j.customerId,
      customerName: j.customer.name,
      customerPhone: j.customer.phone,
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> {tr('t10misc.marketing.backToMarketing')}
      </Link>
      <PageHeader
        title={tr('t10misc.marketing.reviewsTitle')}
        subtitle={tr('t10misc.marketing.reviewsSubtitle')}
      />
      <ReviewRequestsClient
        businessId={businessId}
        businessName={business?.name ?? 'our business'}
        rows={rows}
        locale={locale}
      />
    </div>
  );
}
