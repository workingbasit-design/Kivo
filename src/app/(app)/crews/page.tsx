import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { CrewCreateForm } from '@/components/CrewForm';

export const dynamic = 'force-dynamic';

export default async function CrewsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const L = (k: string) => t(locale, `crews.${k}`);

  const crews = await prisma.crew.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    include: {
      members: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      _count: { select: { jobs: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={L('title')} subtitle={L('subtitle')} />

      {crews.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={28} className="text-lime-600" aria-hidden />}
            title={L('noCrews')}
            description={L('noCrewsDesc')}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {crews.map((crew) => (
            <Link
              key={crew.id}
              href={`/crews/${crew.id}`}
              className="block min-h-[44px]"
            >
              <Card className="p-4 hover:border-lime-300 transition-colors h-full">
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: crew.color ?? '#a3e635' }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-zinc-900 truncate">
                      {crew.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {L('memberCount').replace('{count}', String(crew.members.length))}
                      {' · '}
                      {L('jobs').replace('{count}', String(crew._count.jobs))}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-zinc-400 shrink-0" aria-hidden />
                </div>
                {crew.members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {crew.members.slice(0, 6).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {m.name}
                      </span>
                    ))}
                    {crew.members.length > 6 && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
                        +{crew.members.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-xs font-bold text-zinc-500 mb-2 px-1">
          {L('newCrew')}
        </h2>
        <Card className="p-5">
          <CrewCreateForm locale={locale} />
        </Card>
      </section>
    </div>
  );
}
