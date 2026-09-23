import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';
import TeamClient from '@/components/TeamClient';

export const metadata = { title: 'Team | EveryJob' };

export default async function TeamPage() {
  const { user, businessId } = await requireAuth();

  // Only admins can manage the team.
  if (user.role !== 'ADMIN') {
    redirect('/settings');
  }

  const members = await prisma.user.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle="Invite staff and control who can do what."
      />
      <TeamClient
        members={members.map(
          (m: {
            id: string;
            name: string | null;
            email: string;
            role: string;
            createdAt: Date;
          }) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role,
            createdAt: m.createdAt.toISOString(),
          })
        )}
        currentUserId={user.id}
      />
    </div>
  );
}
