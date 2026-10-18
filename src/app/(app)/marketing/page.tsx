import Link from 'next/link';
import { Megaphone, Plus, Star } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Button, Card, EmptyState } from '@/components/kit';
import { type Audience } from '@/lib/marketing';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { formatDateShort } from '@/lib/utils';
import { StatusPill } from '../_components/status-ui';

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
        summary={tr('t10misc.marketing.subtitle')}
        actionLabel={tr('t10misc.marketing.newCampaign')}
        actionHref="/marketing/new"
        actionIcon={Plus}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" sm href="/marketing/reviews">
          <Star size={14} /> {tr('t10misc.marketing.reviewRequests')}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title={tr('t10misc.marketing.noCampaignsTitle')}
            text={tr('t10misc.marketing.noCampaignsDesc')}
          />
          <div className="flex justify-center pb-10 -mt-6">
            <Button href="/marketing/new" variant="primary" sm>
              <Plus size={14} /> {tr('t10misc.marketing.firstCampaign')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/marketing/${c.id}`}>
              <Card className="p-4 md:p-5 hover:border-smoke transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink truncate">{c.name}</p>
                    <p className="text-xs text-ink-2 mt-1 truncate">{c.subject}</p>
                    <p className="text-[11px] text-ink-2 mt-1.5">
                      {tr(AUDIENCE_KEY[c.audience as Audience] ?? c.audience)} ·{' '}
                      {formatDateShort(c.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
