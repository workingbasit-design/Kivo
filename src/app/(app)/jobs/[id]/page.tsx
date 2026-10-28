import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { getTaxConfig, calcTaxCents, CA_PROVINCES } from '@/lib/tax';
import { sumLaborMinutes, summarizeJobCost } from '@/lib/costing';
import { entryMinutes, formatDuration } from '@/lib/timesheets';
import { centsToDollars } from '@/lib/money';
import { isJobLate, isRunningOver, jobStatusLabel, deriveJobWindow } from '@/lib/job-status';
import { tradeKeyForService } from '@/lib/trade-icons';
import {
  formatDateLabel,
  hasJobTime,
  formatJobTime,
  localeDateTag,
} from '@/lib/utils';
import { formatDisplayDate } from '@/lib/attention';
import { getReviewEligibility } from '@/lib/review-eligibility';
import { isServiceListed, readServiceAreas } from '@/lib/directory-prompt';
import JobDetailClient, { type JobDetailVm } from './JobDetailClient';
import RecordLastOpened from '@/components/RecordLastOpened';

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

/** "2:30 p.m." in the business timezone (lowercase, mockup style). */
function formatInstantTime(d: Date, timezone: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hm = `${get('hour')}:${get('minute')}`;
  if (locale === 'fr') return `${hm}`;
  const ap = get('dayPeriod').toLowerCase().replace('am', 'a.m.').replace('pm', 'p.m.');
  return `${hm} ${ap}`;
}

/** "Saturday, October 17" in the business timezone. */
function formatFullDate(d: Date, timezone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { businessId, user, role } = await requireAuth();
  const locale: Locale = await getLocale();
  const dateLocale = localeDateTag(locale);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      currency: true,
      name: true,
      regionCode: true,
      taxRegion: true,
      timezone: true,
      defaultHourlyRateCents: true,
    },
  });
  const timezone = business?.timezone ?? 'America/Toronto';

  const job = await prisma.job.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      jobAssignments: { select: { userId: true } },
      property: { select: { id: true, label: true, address: true, province: true } },
      service: {
        select: { name: true, nameFr: true, category: true, iconKey: true },
      },
      jobNotes: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
      timeEntries: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { clockIn: 'desc' },
      },
      checklistItems: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      expenses: { orderBy: { spentAt: 'desc' } },
      fieldValues: {
        include: { field: { select: { name: true, businessId: true } } },
        orderBy: { field: { name: 'asc' } },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          totalCents: true,
          status: true,
          milestoneLabel: true,
        },
      },
      subcontractors: {
        include: { subcontractor: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!job) notFound();

  const [members, templates, customerJobCount, reviewEligibility, bookingPage, allSubs] =
    await Promise.all([
      prisma.membership.findMany({
        where: { businessId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.checklistTemplate.findMany({
        where: { businessId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.job.count({ where: { businessId, customerId: job.customerId } }),
      getReviewEligibility(businessId, job.id),
      prisma.bookingPage.findUnique({
        where: { businessId },
        select: { serviceAreas: true },
      }),
      prisma.subcontractor.findMany({
        where: { businessId },
        select: { id: true, name: true, defaultRateCents: true },
        orderBy: { name: 'asc' },
      }),
    ]);

  // Lesson 8 prompt facts (status is gated client-side on the LIVE
  // status, so an in-session Mark complete reveals the prompt without
  // a reload): consented customer + profile page exists + service not
  // already listed. No customer data is passed — only the service name.
  const directoryPrompt =
    bookingPage &&
    job.customer.messageConsent &&
    !isServiceListed(readServiceAreas(bookingPage.serviceAreas), job.title)
      ? { service: job.title.trim() }
      : null;

  const now = new Date();
  const late = isJobLate(
    { date: job.date, startAt: job.startAt, status: job.status },
    now,
    timezone,
  );

  // D3a (2026-10-21): live location sharing lives on this page (the
  // /tracking page points techs here). The card renders only for an
  // active job (the ping/share APIs reject anything else) and only for
  // the people who work it: the assigned member(s) or an owner/admin
  // (role matrix: MY_DAY / DISPATCH_ASSIGN holders).
  const isAssignedToMe =
    job.assignedToId === user.id ||
    job.jobAssignments.some((a) => a.userId === user.id);
  const canShareLocation =
    (job.status === 'SCHEDULED' || job.status === 'IN PROGRESS') &&
    (role === 'OWNER' || role === 'ADMIN' || isAssignedToMe);
  const notifyTechName = job.assignedTo?.name ?? user.name ?? '';
  const runningOver = isRunningOver(
    {
      status: job.status,
      endAt: job.endAt,
      startAt: job.startAt,
      date: job.date,
      time: job.time,
    },
    now,
  );

  // When & where.
  const jobDay = job.startAt ?? job.date;
  const relativeDay = formatDisplayDate(jobDay, timezone, locale);
  const startLabel = job.startAt
    ? formatInstantTime(job.startAt, timezone, locale)
    : hasJobTime(job.time)
      ? formatJobTime(job.time, locale)
      : null;
  // End label: the stored endAt, or the derived window end (start + the
  // standard job length) for rows created before endAt was populated.
  const derivedEnd = deriveJobWindow({
    date: job.date,
    time: job.time,
    startAt: job.startAt,
    endAt: job.endAt,
  }).endAt;
  const endLabel = derivedEnd
    ? formatInstantTime(derivedEnd, timezone, locale)
    : null;
  const whenPrimary =
    startLabel && endLabel
      ? `${relativeDay}, ${startLabel} – ${endLabel}`
      : startLabel
        ? `${relativeDay}, ${startLabel}`
        : relativeDay;
  const whenSecondary = formatFullDate(jobDay, timezone, locale);

  // Money: quoted price + tax through the shared engine (integer cents).
  const priceCents = Number(job.priceCents);
  const taxConfig = getTaxConfig(business?.regionCode, business?.taxRegion);
  const taxRates = taxConfig.taxes.map((tx) => ({
    taxType: tx.name,
    rateBps: Math.round(tx.rate * 1000),
  }));
  const { taxCents } = calcTaxCents(priceCents, taxRates);
  const provinceName =
    CA_PROVINCES.find((p) => p.code === taxConfig.taxRegion)?.name ?? '';
  const taxLabel = provinceName
    ? `${taxConfig.label} (${provinceName})`
    : taxConfig.label;

  // Costing: quoted price vs labor + expenses + subcontractor payouts
  // (same math as JobCostingCard).
  const laborMinutes = sumLaborMinutes(job.timeEntries);
  const hourlyRate =
    business?.defaultHourlyRateCents != null
      ? centsToDollars(business.defaultHourlyRateCents)
      : null;
  const subcontractorCents = job.subcontractors.reduce(
    (sum, r) => sum + (r.amountCents != null ? Number(r.amountCents) : 0),
    0,
  );
  const costing = summarizeJobCost({
    price: centsToDollars(priceCents),
    laborMinutes,
    hourlyRate,
    expenses: job.expenses.map((e) => ({
      category: e.category,
      amount: centsToDollars(e.amountCents),
    })),
    subcontractorCost: subcontractorCents / 100,
  });
  const showCosting =
    priceCents > 0 || laborMinutes > 0 || costing.expensesTotal > 0 || subcontractorCents > 0;

  const vm: JobDetailVm = {
    id: job.id,
    title: job.title,
    status: job.status,
    tradeKey: job.service
      ? tradeKeyForService(job.service)
      : tradeKeyForService({ name: job.title }),
    late,
    runningOver,
    whenPrimary,
    whenSecondary,
    address: job.address?.trim() ? job.address.trim() : null,
    property: job.property
      ? {
          label: job.property.label,
          address: job.property.address,
          province: job.property.province,
        }
      : null,
    notes: job.notes?.trim() ? job.notes.trim() : null,
    priceCents,
    taxLabel,
    taxCents,
    totalCents: priceCents + taxCents,
    customer: {
      id: job.customer.id,
      name: job.customer.name,
      phone: job.customer.phone,
      email: job.customer.email,
      initials: initialsOf(job.customer.name),
      sinceYear: job.customer.createdAt.getFullYear(),
      jobsCount: customerJobCount,
    },
    tech: job.assignedTo
      ? {
          id: job.assignedTo.id,
          name: job.assignedTo.name ?? '',
          initials: initialsOf(job.assignedTo.name),
        }
      : job.technician?.trim()
        ? { id: '', name: job.technician.trim(), initials: initialsOf(job.technician) }
        : null,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? '',
      initials: initialsOf(m.user.name),
    })),
    progressStage: ['NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID'].indexOf(
      job.status,
    ),
    bookedLabel: formatDateLabel(job.createdAt, dateLocale),
    statusChangedLabel: formatDateLabel(job.updatedAt, dateLocale),
    statusLabel: jobStatusLabel(job.status, locale),
    createdLabel: t(locale, 't10work.jobCreatedOn').replace(
      '{date}',
      formatDateLabel(job.createdAt, dateLocale),
    ),
    invoices: job.invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      label: inv.milestoneLabel || inv.number,
      totalCents: Number(inv.totalCents),
      status: inv.status,
    })),
    costing: showCosting
      ? {
          profitCents: Math.round(costing.profit * 100),
          marginPct: costing.marginPct,
          costCents: Math.round(costing.totalCost * 100),
          laborCents: Math.round(costing.laborCost * 100),
          laborDuration: formatDuration(laborMinutes),
          expensesCents: Math.round(costing.expensesTotal * 100),
          subcontractorCents,
          hourlyRate,
        }
      : null,
    subcontractors: job.subcontractors.map((r) => ({
      id: r.id,
      subcontractorId: r.subcontractorId,
      name: r.subcontractor.name,
      hours: r.hours,
      amountCents: r.amountCents != null ? Number(r.amountCents) : null,
      note: r.note,
    })),
    allSubcontractors: allSubs.map((s) => ({
      id: s.id,
      name: s.name,
      defaultRateCents: s.defaultRateCents != null ? Number(s.defaultRateCents) : null,
    })),
    jobNotes: job.jobNotes.map((n) => ({
      id: n.id,
      content: n.content,
      authorName: n.author.name || n.author.email,
      createdAtLabel: formatDateLabel(n.createdAt, dateLocale),
    })),
    customFields: job.fieldValues
      .filter((v) => v.field.businessId === businessId && v.value.trim() !== '')
      .map((v) => ({ name: v.field.name, value: v.value })),
    checklistItems: job.checklistItems.map((i) => ({
      id: i.id,
      label: i.label,
      done: i.done,
    })),
    checklistTemplates: templates.map((tpl) => ({ id: tpl.id, name: tpl.name })),
    expenses: job.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: centsToDollars(e.amountCents),
      category: e.category,
      spentAt: formatDateLabel(e.spentAt, dateLocale),
    })),
    currency: business?.currency ?? 'CAD',
    timeEntries: job.timeEntries.slice(0, 8).map((e) => ({
      name: e.user.name || e.user.email,
      dateLabel: formatDateLabel(e.clockIn, dateLocale),
      active: !e.clockOut,
      minutes: entryMinutes(e.clockIn, e.clockOut),
    })),
    timeEntryMembers: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email ?? '',
    })),
    isAdmin: role === 'ADMIN',
    selfId: user.id,
    canShareLocation,
    businessName: business?.name ?? '',
    regionCode: business?.regionCode ?? null,
    notifyTechName,
    reviewEligible: reviewEligibility.ok,
    directoryPrompt,
    locale,
  };

  return (
    <>
      <RecordLastOpened kind="job" id={job.id} title={vm.title} subtitle={vm.customer.name} />
      <JobDetailClient vm={vm} />
    </>
  );
}
