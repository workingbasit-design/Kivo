import { notFound } from 'next/navigation';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft, BadgeCheck, Send } from 'lucide-react';
import { sendCustomerMessage } from '@/app/actions/customer-requests';
import { cn } from '@/lib/utils';
import { Avatar, BackLink, Card } from '@/components/customer/ui';

export default async function CustomerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCustomerAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);
  const { id } = await params;

  const req = await prisma.quoteRequest.findFirst({
    where: { id, customerId: session.customer.id },
    include: {
      business: { select: { name: true, logoUrl: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!req) notFound();

  return (
    <div className="space-y-4">
      <div className="ej-anim-fade-up">
        <BackLink href="/customer/requests">
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          {tr('customer.quote.myRequests')}
        </BackLink>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '60ms' }}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={req.business.name} logoUrl={req.business.logoUrl} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[15px] text-zinc-900 truncate">{req.business.name}</h1>
                <BadgeCheck className="w-4 h-4 text-indigo-600 fill-indigo-100 shrink-0" />
              </div>
              <p className="text-xs text-zinc-500">
                {req.service} · {tr(`customer.requests.status.${req.status}`)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '120ms' }}>
        <Card className="p-4 space-y-3 min-h-[200px]">
          {req.messages.map((msg) => {
            const mine = msg.senderType === 'customer';
            return (
              <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm transition-transform duration-200 hover:scale-[1.01]',
                    mine
                      ? 'bg-indigo-600 text-white rounded-br-md shadow-indigo-600/20'
                      : 'bg-zinc-100 text-zinc-800 rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p className={cn('text-[10px] mt-1', mine ? 'text-indigo-200' : 'text-zinc-400')}>
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <form action={sendCustomerMessage} className="ej-anim-fade-up flex gap-2" style={{ animationDelay: '180ms' }}>
        <input type="hidden" name="requestId" value={req.id} />
        <input
          name="body"
          required
          maxLength={2000}
          placeholder={tr('customer.quote.writeMessage')}
          aria-label={tr('customer.quote.sendMessage')}
          className="flex-1 min-h-[48px] rounded-2xl bg-white border border-zinc-200 px-4 text-[15px] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 hover:border-zinc-300 shadow-sm"
        />
        <button
          type="submit"
          aria-label={tr('customer.quote.sendMessage')}
          className="ej-icon-hover w-12 h-12 rounded-2xl bg-indigo-600 text-white inline-flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-md"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
