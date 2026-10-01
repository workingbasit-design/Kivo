import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { Inbox, ChevronRight, Clock } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent',
  replied: 'Replied',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
};

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  replied: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  declined: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  completed: 'bg-amber-100 text-amber-700 border-amber-200',
};

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">My requests</h1>
        {activeCount > 0 && (
          <span className="text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full px-2.5 py-1">
            {activeCount} active
          </span>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200/80 p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="font-bold text-zinc-900">No quote requests yet</p>
          <p className="text-sm text-zinc-500 mt-1 mb-5 max-w-xs mx-auto">
            Search for a pro and request a quote — it takes less than a minute.
          </p>
          <Link
            href="/customer"
            className="inline-flex min-h-[48px] items-center px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25"
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
              className="block bg-white rounded-3xl border border-zinc-200/80 p-4 shadow-sm hover:shadow-md hover:border-indigo-200 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 overflow-hidden shadow-md shadow-indigo-500/20">
                  {req.business.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={req.business.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white">{req.business.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[15px] text-zinc-900 truncate">
                      {req.business.name}
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        STATUS_STYLE[req.status] || STATUS_STYLE.sent
                      }`}
                    >
                      {STATUS_LABEL[req.status] || req.status}
                    </span>
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
                <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
