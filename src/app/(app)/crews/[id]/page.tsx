import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card } from '@/components/ui';
import { CrewForm } from '@/components/CrewForm';

export const dynamic = 'force-dynamic';

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const L = (k: string) => t(locale, `crews.${k}`);

  const crew = await prisma.crew.findFirst({
    where: { id, businessId },
    include: {
      members: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  });
  if (!crew) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/crews"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 min-h-[44px] px-2 -ml-2"
      >
        <ArrowLeft size={14} aria-hidden /> {L('title')}
      </Link>

      <PageHeader title={L('editCrew')} subtitle={crew.name} />

      <Card className="p-5 md:p-6">
        <CrewForm
          locale={locale}
          initial={{
            id: crew.id,
            name: crew.name,
            color: crew.color,
            members: crew.members,
          }}
        />
      </Card>
    </div>
  );
}
