import { notFound } from 'next/navigation';
import { Sparkles, Star } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import PublicReviewForm from '@/components/PublicReviewForm';

// Public page — no auth. Only the business name is ever shown here.

export async function generateMetadata({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  return { title: business ? `Review ${business.name} | Kivo` : 'Leave a review | Kivo' };
}

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // Tenant-safe: only the business name is selected — nothing else leaks.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  if (!business) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#6329d4] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Leave a review for
          </p>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mt-1">
            {business.name}
          </h1>
          <div className="flex items-center justify-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={16} className="fill-amber-400 text-amber-400" />
            ))}
          </div>
        </div>

        <PublicReviewForm businessId={businessId} />

        <p className="text-center text-[11px] text-zinc-400">
          Powered by Kivo — every job, one place.
        </p>
      </div>
    </div>
  );
}
