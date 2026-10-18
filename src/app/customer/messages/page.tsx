import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { MessageCircle, ChevronRight } from '@/components/icons';
import { Card, EmptyState } from '@/components/kit';

/**
 * Messages inbox - one thread per quote request with replies.
 */
export default async function CustomerMessagesPage() {
  const session = await requireCustomerAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);

  const threads = await prisma.quoteRequest.findMany({
    where: { customerId: session.customer.id },
    include: {
      business: { select: { name: true, logoUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const unreadCount = threads.filter(
    (t) => t.messages[0]?.senderType === 'business'
  ).length;

  return (
    <div className="space-y-4">
      <div className="ej-anim-fade-up flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">{tr('customer.messages.title')}</h1>
        {unreadCount > 0 && (
          <span className="ej-anim-scale-in text-xs font-bold text-hero-ink bg-danger rounded-full px-2.5 py-1 shadow-sm">
            {tr('customer.messages.newMessages').replace('{count}', String(unreadCount)).replace('{x}', unreadCount === 1 ? '' : 'x')}
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={tr('customer.messages.emptyTitle')}
          text={tr('customer.messages.emptyHint')}
        />
      ) : (
        <div className="space-y-3">
          {threads.map((t, i) => {
            const lastMsg = t.messages[0];
            const isUnread = lastMsg?.senderType === 'business';
            return (
              <div
                key={t.id}
                className="ej-anim-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <Link href={`/customer/requests/${t.id}`} className="group block">
                  <Card className="p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
                        <span
                          aria-hidden="true"
                          className="grid w-[42px] h-[42px] place-items-center rounded-full bg-surface-2 ring-1 ring-inset ring-line font-bold text-ink text-[15px] overflow-hidden"
                        >
                          {t.business.logoUrl ? (
                            <img src={t.business.logoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            t.business.name.charAt(0).toUpperCase()
                          )}
                        </span>
                        {isUnread && (
                          <span className="ej-anim-scale-in absolute -top-1 -right-1 w-4 h-4 bg-danger border-2 border-surface rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-[15px] truncate ${isUnread ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>
                          {t.business.name}
                        </h3>
                        <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-ink font-medium' : 'text-ink-2'}`}>
                          {lastMsg ? (
                            <>
                              {lastMsg.senderType === 'business' ? '' : `${tr('customer.messages.you')}: `}
                              {lastMsg.body}
                            </>
                          ) : (
                            t.service
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-ink-2 shrink-0 transition-all duration-300 group-hover:text-ink group-hover:translate-x-0.5" />
                    </div>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
