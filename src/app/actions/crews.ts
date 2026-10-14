'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';

export type CrewActionResult = { ok?: boolean; error?: string };

const GENERIC_ERROR = 'Too many requests. Please wait a moment and try again.';

async function checkLimit(userId: string, prefix: string): Promise<CrewActionResult | null> {
  const rl = rateLimit(`${prefix}:${userId}`, ACTION_LIMIT);
  if (!rl.ok) return { error: GENERIC_ERROR };
  return null;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Create a crew for this business (tenant-scoped). */
export async function createCrew(name: string, color: string): Promise<CrewActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'createCrew');
  if (limited) return limited;

  const cleanName = name.trim().slice(0, 60);
  if (cleanName.length < 2) return { error: 'Enter a crew name (min 2 characters).' };
  const cleanColor = COLOR_RE.test(color) ? color : '#a3e635';

  await prisma.crew.create({
    data: { name: cleanName, color: cleanColor, businessId },
  });
  revalidatePath('/crews');
  return { ok: true };
}

/** Rename / recolor a crew (tenant-scoped). */
export async function updateCrew(id: string, name: string, color: string): Promise<CrewActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'updateCrew');
  if (limited) return limited;

  const cleanName = name.trim().slice(0, 60);
  if (cleanName.length < 2) return { error: 'Enter a crew name (min 2 characters).' };
  const cleanColor = COLOR_RE.test(color) ? color : '#a3e635';

  const crew = await prisma.crew.findFirst({ where: { id, businessId } });
  if (!crew) return { error: 'Crew not found.' };

  await prisma.crew.update({
    where: { id },
    data: { name: cleanName, color: cleanColor },
  });
  revalidatePath('/crews');
  return { ok: true };
}

/** Delete a crew. Jobs keep their data - their crew link is cleared. */
export async function deleteCrew(id: string): Promise<CrewActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'deleteCrew');
  if (limited) return limited;

  const crew = await prisma.crew.findFirst({ where: { id, businessId } });
  if (!crew) return { error: 'Crew not found.' };

  await prisma.crew.delete({ where: { id } });
  revalidatePath('/crews');
  return { ok: true };
}

/** Add a member to a crew (tenant-scoped via the crew). Optionally links a team user. */
export async function addMember(crewId: string, name: string, userId?: string): Promise<CrewActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'addMember');
  if (limited) return limited;

  const crew = await prisma.crew.findFirst({ where: { id: crewId, businessId } });
  if (!crew) return { error: 'Crew not found.' };

  const cleanName = name.trim().slice(0, 80);
  if (cleanName.length < 2) return { error: 'Enter a member name (min 2 characters).' };

  // Optional team-user link: only link users on the same business.
  let linkUserId: string | null = null;
  if (userId) {
    const teamUser = await prisma.membership.findFirst({
      where: { userId, businessId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (teamUser) linkUserId = teamUser.id;
  }

  await prisma.crewMember.create({
    data: { crewId: crew.id, name: cleanName, userId: linkUserId },
  });
  revalidatePath('/crews');
  return { ok: true };
}

/** Remove a member from a crew (tenant-scoped via the crew). */
export async function removeMember(memberId: string): Promise<CrewActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id, 'removeMember');
  if (limited) return limited;

  const member = await prisma.crewMember.findFirst({
    where: { id: memberId, crew: { businessId } },
  });
  if (!member) return { error: 'Member not found.' };

  await prisma.crewMember.delete({ where: { id: memberId } });
  revalidatePath('/crews');
  return { ok: true };
}
