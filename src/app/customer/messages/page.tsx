import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { MessageCircle, ChevronRight } from 'lucide-react';
import {
  Avatar,
  Card,
  EmptyState,
  PageHeader,
  Stagger,
} from '@/components/customer/ui';

/**
 * Messages inbox — one thread per quote request with replies.
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
      <PageHeader
        title={tr('customer.messages.title')}
        action={
          unreadCount > 0 ? (
            <span className="ej-anim-scale-in text-xs font-bold text-white bg-rose-500 rounded-full px-2.5 py-1 shadow-sm shadow-rose-500/30">
              {tr('customer.messages.newMessages').replace('{count}', String(unreadCount))}
            </span>
          ) : undefined
        }
      />

      {threads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={tr('customer.messages.emptyTitle')}
          hint={tr('customer.messages.emptyHint')}
          delay={80}
        />
      ) : (
        <div className="space-y-3">
          {threads.map((t, i) => {
            const lastMsg = t.messages[0];
            const isUnread = lastMsg?.senderType === 'business';
            return (
              <Stagger key={t.id} index={i}>
                <Link href={`/customer/requests/${t.id}`} className="group block">
                  <Card hover className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
                        <Avatar name={t.business.name} logoUrl={t.business.logoUrl} />
                        {isUnread && (
                          <span className="ej-anim-scale-in absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full shadow-sm" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-[15px] truncate ${isUnread ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-800'}`}>
                          {t.business.name}
                        </h3>
                        <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-zinc-700 font-medium' : 'text-zinc-500'}`}>
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
                      <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0 transition-all duration-300 group-hover:text-indigo-500 group-hover:translate-x-0.5" />
                    </div>
                  </Card>
                </Link>
              </Stagger>
            );
          })}
        </div>
      )}
    </div>
  );
}
