import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { Inbox, ChevronRight, Star } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent',
  replied: 'Replied',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
};

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  replied: 'bg-indigo-100 text-indigo-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-zinc-100 text-zinc-500',
  completed: 'bg-amber-100 text-amber-700',
};

export default async function CustomerRequestsPage() {
  const session = await requireCustomerAuth();

  const requests = await prisma.quoteRequest.findMany({
    where: { customerId: session.customer.id },
    include: {
      business: { select: { name: true, logoUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-zinc-900">My requests</h1>

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
          <Inbox className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-700">No quote requests yet</p>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Search for a pro and request a quote to get started.
          </p>
          <Link
            href="/customer"
            className="inline-flex min-h-[44px] items-center px-5 rounded-xl bg-indigo-600 text-white text-sm font-bold"
          >
            Find a pro
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/customer/requests/${req.id}`}
              className="block bg-white rounded-2xl border border-zinc-200 p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {req.business.logoUrl ? (
                    <img src={req.business.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-indigo-600">{req.business.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[15px] text-zinc-900 truncate">
                      {req.business.name}
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        STATUS_COLOR[req.status] || STATUS_COLOR.sent
                      }`}
                    >
                      {STATUS_LABEL[req.status] || req.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {req.service} · {new Date(req.updatedAt).toLocaleDateString()}
                  </p>
                  {req.messages[0] && (
                    <p className="text-xs text-zinc-500 truncate mt-1">{req.messages[0].body}</p>
                  )}
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
