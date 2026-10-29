'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export type ProjectActionResult = { ok?: boolean; error?: string; id?: string };

const STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PHASE_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

async function checkLimit(userId: string) {
  const rl = rateLimit(`projects:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'track8.rateLimited') };
  }
  return null;
}

/** Create a project, optionally with an initial set of phase names. */
export async function createProject(input: {
  title: string;
  description?: string;
  customerId?: string;
  budgetCents?: number;
  startDate?: string;
  endDate?: string;
  phases?: string[];
}): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const title = input.title.trim();
  if (!title) return { error: t(locale, 'projects.titleRequired') };

  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId },
      select: { id: true },
    });
    if (!c) return { error: t(locale, 'track8.ruleNotFound') };
  }

  const project = await prisma.project.create({
    data: {
      businessId,
      title,
      description: input.description?.trim() || null,
      customerId: input.customerId || null,
      budgetCents: input.budgetCents ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      phases: {
        create: (input.phases ?? [])
          .map((n) => n.trim())
          .filter(Boolean)
          .map((name, i) => ({ name, order: i })),
      },
    },
  });

  revalidatePath('/projects');
  return { ok: true, id: project.id };
}

export async function updateProject(
  id: string,
  input: { title?: string; description?: string; status?: string; budgetCents?: number | null }
): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const p = await prisma.project.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!p) return { error: t(locale, 'track8.ruleNotFound') };

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: t(locale, 'projects.titleRequired') };
    data.title = title;
  }
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status)) return { error: t(locale, 'track8.ruleNotFound') };
    data.status = input.status;
  }
  if (input.budgetCents !== undefined) data.budgetCents = input.budgetCents;

  await prisma.project.updateMany({ where: { id, businessId }, data });
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const p = await prisma.project.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!p) return { error: t(locale, 'track8.ruleNotFound') };

  // Jobs keep their records; only the project link is cleared.
  await prisma.job.updateMany({ where: { projectId: id, businessId }, data: { projectId: null, projectPhaseId: null } });
  // Tenant guard fails closed on delete() without a top-level businessId
  // (same class as the 2026-10-29 crew Save/Delete crash).
  await prisma.project.deleteMany({ where: { id, businessId } });
  revalidatePath('/projects');
  return { ok: true };
}

export async function addPhase(projectId: string, name: string): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const p = await prisma.project.findFirst({
    where: { id: projectId, businessId },
    select: { id: true, phases: { select: { order: true } } },
  });
  if (!p) return { error: t(locale, 'track8.ruleNotFound') };
  const clean = name.trim();
  if (!clean) return { error: t(locale, 'projects.phaseNameRequired') };

  const order = p.phases.reduce((m, ph) => Math.max(m, ph.order), -1) + 1;
  const phase = await prisma.projectPhase.create({
    data: { projectId: p.id, name: clean, order },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, id: phase.id };
}

export async function setPhaseStatus(
  phaseId: string,
  status: string
): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();
  if (!PHASE_STATUSES.includes(status)) return { error: t(locale, 'track8.ruleNotFound') };

  const ph = await prisma.projectPhase.findFirst({
    where: { id: phaseId, project: { businessId } },
    select: { id: true, projectId: true },
  });
  if (!ph) return { error: t(locale, 'track8.ruleNotFound') };

  await prisma.projectPhase.update({ where: { id: ph.id }, data: { status } });
  revalidatePath(`/projects/${ph.projectId}`);
  return { ok: true };
}

export async function deletePhase(phaseId: string): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const ph = await prisma.projectPhase.findFirst({
    where: { id: phaseId, project: { businessId } },
    select: { id: true, projectId: true },
  });
  if (!ph) return { error: t(locale, 'track8.ruleNotFound') };

  await prisma.job.updateMany({
    where: { projectPhaseId: phaseId, businessId },
    data: { projectPhaseId: null },
  });
  await prisma.projectPhase.delete({ where: { id: ph.id } });
  revalidatePath(`/projects/${ph.projectId}`);
  return { ok: true };
}

/** Attach a job to a project (and optionally a phase). */
export async function attachJobToProject(
  jobId: string,
  projectId: string,
  phaseId?: string
): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const [job, project] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, businessId }, select: { id: true } }),
    prisma.project.findFirst({ where: { id: projectId, businessId }, select: { id: true } }),
  ]);
  if (!job || !project) return { error: t(locale, 'track8.ruleNotFound') };

  if (phaseId) {
    const ph = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId: project.id },
      select: { id: true },
    });
    if (!ph) return { error: t(locale, 'track8.ruleNotFound') };
  }

  await prisma.job.updateMany({
    where: { id: job.id, businessId },
    data: { projectId: project.id, projectPhaseId: phaseId ?? null },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function detachJobFromProject(jobId: string): Promise<ProjectActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, projectId: true },
  });
  if (!job) return { error: t(locale, 'track8.ruleNotFound') };

  await prisma.job.updateMany({
    where: { id: job.id, businessId },
    data: { projectId: null, projectPhaseId: null },
  });
  if (job.projectId) revalidatePath(`/projects/${job.projectId}`);
  return { ok: true };
}
