import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * Jobs of this business not already attached to any project -
 * candidates for linking to a phase.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { businessId } = await requireAuth();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const jobs = await prisma.job.findMany({
    where: { businessId, projectId: null, status: { notIn: ['CANCELLED'] } },
    select: { id: true, title: true },
    orderBy: { date: 'desc' },
    take: 100,
  });

  return NextResponse.json({ jobs });
}
