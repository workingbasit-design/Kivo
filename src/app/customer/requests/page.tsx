import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Inbox, ChevronRight, Clock } from '@/components/icons';
import { Button, Card, Chip, EmptyState, StatusBadge } from '@/components/kit';
import type { StatusBadgeTone } from '@/components/kit';

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

const STATUS_TONES: Record<string, StatusBadgeTone> = {
  sent: 'info',
  replied: 'info',
  accepted: 'done',
  declined: 'late',
  completed: 'neutral',
};

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
      <div className="ej-anim-fade-up flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">{tr('customer.requests.title')}</h1>
        {activeCount > 0 && (
          <Chip tone="neutral">
            {tr('customer.requests.active').replace('{count}', String(activeCount)).replace('{s}', activeCount === 1 ? '' : 's')}
          </Chip>
        )}
      </div>

      {requests.length === 0 ? (
        <>
          <EmptyState
            icon={<Inbox />}
            title={tr('customer.requests.emptyTitle')}
            text={tr('customer.requests.emptyHint')}
          />
          <div className="text-center -mt-4 pb-2">
            <Button href="/customer" sm>
              {tr('customer.requests.findPro')}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {requests.map((req, i) => (
            <div
              key={req.id}
              className="ej-anim-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <Link
                href={`/customer/requests/${req.id}`}
                className="group block"
              >
                <Card className="p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid w-[42px] h-[42px] place-items-center rounded-full bg-surface-2 ring-1 ring-inset ring-line font-bold text-ink text-[15px] flex-none overflow-hidden transition-transform duration-300 group-hover:scale-105"
                    >
                      {req.business.logoUrl ? (
                        <img src={req.business.logoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        req.business.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[15px] text-ink truncate">
                          {req.business.name}
                        </h3>
                        <StatusBadge
                          tone={STATUS_TONES[req.status] ?? 'neutral'}
                        >
                          {tr(`customer.requests.status.${req.status}`)}
                        </StatusBadge>
                      </div>
                      <p className="text-xs font-medium text-ink truncate mt-0.5">
                        {req.service}
                      </p>
                      {req.messages[0] && (
                        <p className="text-xs text-ink-2 truncate mt-1">{req.messages[0].body}</p>
                      )}
                      <p className="text-[11px] text-ink-2 mt-1 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(req.updatedAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-2 shrink-0 transition-all duration-300 group-hover:text-ink group-hover:translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
