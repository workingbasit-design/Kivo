import Link from 'next/link';
import { Megaphone, Plus, Star } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge, EmptyState } from '@/components/ui';
import { AUDIENCE_LABELS, type Audience } from '@/lib/marketing';
import { formatDateShort } from '@/lib/utils';

export const metadata = { title: 'Marketing | EveryJob' };

export default async function MarketingPage() {
  const { businessId } = await requireAuth();

  const campaigns = await prisma.campaign.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        subtitle="Campaigns and review requests. EveryJob never sends messages itself — you copy and send via WhatsApp or SMS."
        actions={
          <>
            <Link
              href="/marketing/reviews"
              className="bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm"
            >
              <Star size={14} /> Review requests
            </Link>
            <Link
              href="/marketing/new"
              className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> New campaign
            </Link>
          </>
        }
      />

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone size={24} />}
            title="No campaigns yet"
            description="Create a campaign to message a group of customers — a festive offer, a service reminder, or a simple check-in."
            action={
              <Link
                href="/marketing/new"
                className="bg-ink hover:bg-graphite text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <Plus size={14} /> Create your first campaign
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
                      {AUDIENCE_LABELS[c.audience as Audience] ?? c.audience} ·{' '}
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
