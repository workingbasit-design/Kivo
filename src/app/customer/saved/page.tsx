import Link from 'next/link';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { Heart, BadgeCheck, Star, MessageSquareQuote } from 'lucide-react';

export default async function CustomerSavedPage() {
  const session = await requireCustomerAuth();

  const saved = await prisma.savedPro.findMany({
    where: { customerId: session.customer.id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          address: true,
          phone: true,
          whatsappNumber: true,
          regionCode: true,
          bookingPage: { select: { slug: true } },
          services: { select: { name: true }, take: 5 },
          reviews: { select: { rating: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-zinc-900">Saved pros</h1>

      {saved.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center">
          <Heart className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-700">No saved pros yet</p>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Tap the heart on any pro to save them here for later.
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
          {saved.map(({ business: b }) => (
            <article key={b.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-indigo-600">{b.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-[15px] text-zinc-900 truncate">{b.name}</h3>
                    <BadgeCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  </div>
                  {b.services.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {b.services.map((s) => s.name).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/customer/request/${b.bookingPage!.slug}`}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
                >
                  <MessageSquareQuote className="w-4 h-4" />
                  Request quote
                </Link>
                <Link
                  href={`/directory/${b.bookingPage!.slug}`}
                  className="min-h-[44px] px-4 inline-flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 text-sm font-semibold"
                >
                  View
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
