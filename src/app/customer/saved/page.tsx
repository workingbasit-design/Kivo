import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { localityFromAddress, isPhoneVerified, ratingSummary } from '@/lib/directory';
import SavedProsClient from './saved-client';

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

  const pros = saved.map(({ business: b }) => {
    const { count, avg } = ratingSummary(b.reviews);
    return {
      id: b.id,
      name: b.name,
      logoUrl: b.logoUrl,
      slug: b.bookingPage!.slug,
      locality: localityFromAddress(b.address),
      services: b.services.map((s) => s.name),
      verified: isPhoneVerified(b.phone, b.whatsappNumber, b.regionCode),
      count,
      avg,
    };
  });

  return <SavedProsClient initialPros={pros} />;
}
