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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-zinc-900">Messages</h1>

      {threads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
          <MessageCircle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-700">No conversations yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            When a pro replies to your quote request, it appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/customer/requests/${t.id}`}
              className="block bg-white rounded-2xl border border-zinc-200 p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {t.business.logoUrl ? (
                    <img src={t.business.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-indigo-600">{t.business.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[15px] text-zinc-900 truncate">
                    {t.business.name}
                  </h3>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {t.messages[0]?.senderType === 'business' ? `${t.business.name}: ` : 'You: '}
                    {t.messages[0]?.body || t.service}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
