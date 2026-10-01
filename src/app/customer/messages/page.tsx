import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { MessageCircle, ChevronRight } from 'lucide-react';

/**
 * Messages inbox — one thread per quote request with replies.
 */
export default async function CustomerMessagesPage() {
  const session = await requireCustomerAuth();

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Messages</h1>
        {unreadCount > 0 && (
          <span className="text-xs font-bold text-white bg-rose-500 rounded-full px-2.5 py-1">
            {unreadCount} new
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200/80 p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="font-bold text-zinc-900">No conversations yet</p>
          <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
            When a pro replies to your quote request, the conversation appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => {
            const lastMsg = t.messages[0];
            const isUnread = lastMsg?.senderType === 'business';
            return (
              <Link
                key={t.id}
                href={`/customer/requests/${t.id}`}
                className="block bg-white rounded-3xl border border-zinc-200/80 p-4 shadow-sm hover:shadow-md hover:border-indigo-200 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center overflow-hidden shadow-md shadow-indigo-500/20">
                      {t.business.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.business.logoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-white">{t.business.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {isUnread && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-[15px] truncate ${isUnread ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-800'}`}>
                      {t.business.name}
                    </h3>
                    <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-zinc-700 font-medium' : 'text-zinc-500'}`}>
                      {lastMsg ? (
                        <>
                          {lastMsg.senderType === 'business' ? '' : 'You: '}
                          {lastMsg.body}
                        </>
                      ) : (
                        t.service
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
