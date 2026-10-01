import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, BadgeCheck, Send } from 'lucide-react';
import { sendCustomerMessage } from '@/app/actions/customer-requests';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent',
  replied: 'Replied',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
};

export default async function CustomerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCustomerAuth();
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
      <Link
        href="/customer/requests"
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        My requests
      </Link>

      <div className="bg-white rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
            {req.business.logoUrl ? (
              <img src={req.business.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-indigo-600">{req.business.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-[15px] text-zinc-900 truncate">{req.business.name}</h1>
              <BadgeCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            </div>
            <p className="text-xs text-zinc-500">
              {req.service} · {STATUS_LABEL[req.status] || req.status}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3 min-h-[200px]">
        {req.messages.map((msg) => {
          const mine = msg.senderType === 'customer';
          return (
            <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  mine
                    ? 'bg-indigo-600 text-white rounded-br-md'
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
      </div>

      <form action={sendCustomerMessage} className="flex gap-2">
        <input type="hidden" name="requestId" value={req.id} />
        <input
          name="body"
          required
          maxLength={2000}
          placeholder="Write a message…"
          aria-label="Message"
          className="flex-1 min-h-[48px] rounded-2xl bg-white border border-zinc-200 px-4 text-[15px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="w-12 h-12 rounded-2xl bg-indigo-600 text-white inline-flex items-center justify-center shrink-0 active:scale-[0.95] transition-transform"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
