import Link from 'next/link';
import { Megaphone, Plus, Star } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge, EmptyState } from '@/components/ui';
import { type Audience } from '@/lib/marketing';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { formatDateShort } from '@/lib/utils';

export const metadata = { title: 'Marketing | EveryJob' };

const AUDIENCE_KEY: Record<Audience, string> = {
  ALL_CUSTOMERS: 't10misc.marketing.audienceAll',
  WITH_UNPAID: 't10misc.marketing.audienceUnpaid',
  RECENT_JOBS: 't10misc.marketing.audienceRecent',
};

export default async function MarketingPage() {
  const { businessId } = await requireAuth();
  const locale: Locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const campaigns = await prisma.campaign.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('t10misc.marketing.title')}
        subtitle={tr('t10misc.marketing.subtitle')}
        actions={
          <>
            <Link
              href="/marketing/reviews"
              className="bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm"
            >
              <Star size={14} /> {tr('t10misc.marketing.reviewRequests')}
            </Link>
            <Link
              href="/marketing/new"
              className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> {tr('t10misc.marketing.newCampaign')}
            </Link>
          </>
        }
      />

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone size={24} />}
            title={tr('t10misc.marketing.noCampaignsTitle')}
            description={tr('t10misc.marketing.noCampaignsDesc')}
            action={
              <Link
                href="/marketing/new"
                className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <Plus size={14} /> {tr('t10misc.marketing.firstCampaign')}
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/marketing/${c.id}`}>
              <Card className="p-4 md:p-5 hover:border-smoke transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{c.name}</p>
                    <p className="text-xs text-zinc-500 mt-1 truncate">{c.subject}</p>
                    <p className="text-[11px] text-zinc-400 mt-1.5">
                      {tr(AUDIENCE_KEY[c.audience as Audience] ?? c.audience)} ·{' '}
                      {formatDateShort(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
