import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Inbox, ChevronRight, Clock } from 'lucide-react';
import {
  Avatar,
  Card,
  EmptyState,
  PageHeader,
  PrimaryCTA,
  Stagger,
  StatusBadge,
} from '@/components/customer/ui';

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function CustomerRequestsPage() {
  const session = await requireCustomerAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);

  const requests = await prisma.quoteRequest.findMany({
    where: { customerId: session.customer.id },
    include: {
      business: { select: { name: true, logoUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const activeCount = requests.filter((r) => r.status === 'sent' || r.status === 'replied').length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr('customer.requests.title')}
        action={
          activeCount > 0 ? (
            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full px-2.5 py-1">
              {tr('customer.requests.active').replace('{count}', String(activeCount))}
            </span>
          ) : undefined
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tr('customer.requests.emptyTitle')}
          hint={tr('customer.requests.emptyHint')}
          delay={80}
          action={
            <PrimaryCTA href="/customer">{tr('customer.requests.findPro')}</PrimaryCTA>
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req, i) => (
            <Stagger key={req.id} index={i}>
              <Link
                href={`/customer/requests/${req.id}`}
                className="group block"
              >
                <Card hover className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="transition-transform duration-300 group-hover:scale-105">
                      <Avatar name={req.business.name} logoUrl={req.business.logoUrl} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[15px] text-zinc-900 truncate">
                          {req.business.name}
                        </h3>
                        <StatusBadge
                          status={req.status}
                          label={tr(`customer.requests.status.${req.status}`)}
                        />
                      </div>
                      <p className="text-xs font-medium text-zinc-700 truncate mt-0.5">
                        {req.service}
                      </p>
                      {req.messages[0] && (
                        <p className="text-xs text-zinc-500 truncate mt-1">{req.messages[0].body}</p>
                      )}
                      <p className="text-[11px] text-zinc-400 mt-1 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(req.updatedAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0 transition-all duration-300 group-hover:text-indigo-500 group-hover:translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            </Stagger>
          ))}
        </div>
      )}
    </div>
  );
}
