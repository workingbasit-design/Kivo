'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import {
  refreshAccessToken,
  SCOPE_CALENDAR_READONLY,
  SCOPE_CALENDAR,
  type GoogleErrorKind,
} from '@/lib/google-reviews';
import {
  fetchCalendarEvents,
  mapCalendarEvent,
  zonedDayAndTime,
  localMidnight,
  type CalendarDraft,
} from '@/lib/google-calendar';
import { parseCsv, validateCsvRows, excelRowsToStrings, customerDedupeKey, type CsvType, type CsvRecord, type CustomerRecord, type ServiceRecord, type JobRecord } from '@/lib/csv';
import { toISODateLocal, defaultTimezoneForRegion } from '@/lib/utils';

export type ImportActionResult = {
  ok?: boolean;
  error?: string;
  errorKind?: 'reauth' | GoogleErrorKind;
  drafts?: CalendarDraft[];
  customers?: { id: string; name: string }[];
  valid?: CsvRecord[];
  errors?: { row: number; message: string }[];
  imported?: number;
  skipped?: number;
};

function googleEnv(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function checkLimit(userId: string): Promise<ImportActionResult | null> {
  const rl = rateLimit(`imports:${userId}`, ACTION_LIMIT);
  if (!rl.ok) {
    const locale = await getLocale();
    return { error: t(locale, 'imports.tooMany') };
  }
  return null;
}

/**
 * Minimal token logic (mirrors src/app/actions/google-reviews.ts, kept
 * local because that module's helper is private). Reads the tenant's
 * googleConnection, refreshes the access token when expired, and requires
 * the calendar readonly scope — connections made before Track 6 granted
 * only business.manage and must reconnect.
 */
async function getCalendarAccessToken(businessId: string): Promise<string> {
  const env = googleEnv();
  if (!env) throw Object.assign(new Error('Not configured'), { kind: 'config' as GoogleErrorKind });
  const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
  if (!conn) throw Object.assign(new Error('Not connected'), { kind: 'reauth' as GoogleErrorKind });

  const granted = (conn.scopes ?? '').split(/\s+/).filter(Boolean);
  if (!granted.includes(SCOPE_CALENDAR_READONLY) && !granted.includes(SCOPE_CALENDAR)) {
    const locale = await getLocale();
    throw Object.assign(new Error(t(locale, 'imports.reauthNeeded')), {
      kind: 'reauth' as GoogleErrorKind,
    });
  }

  const stillValid = conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return conn.accessToken;

  if (!conn.refreshToken) {
    throw Object.assign(new Error('No refresh token'), { kind: 'reauth' as GoogleErrorKind });
  }
  const refreshed = await refreshAccessToken(
    { clientId: env.clientId, clientSecret: env.clientSecret, refreshToken: conn.refreshToken },
    fetch
  );
  await prisma.googleConnection.update({
    where: { id: conn.id },
    data: { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt },
  });
  return refreshed.accessToken;
}

/** Customers for the per-event customer dropdown. Tenant-scoped. */
export async function listImportCustomers(): Promise<ImportActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const customers = await prisma.customer.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return { ok: true, customers };
}

/** Fetch calendar events in the range and return import drafts. */
export async function fetchCalendarDrafts(
  timeMinISO: string,
  timeMaxISO: string
): Promise<ImportActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;

  const min = new Date(timeMinISO);
  const max = new Date(timeMaxISO);
  const locale = await getLocale();
  if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime()) || max <= min) {
    return { error: t(locale, 'imports.loadFailed') };
  }

  try {
    const token = await getCalendarAccessToken(businessId);
    const events = await fetchCalendarEvents(token, min.toISOString(), max.toISOString(), fetch);
    const drafts = events.map(mapCalendarEvent).filter((d): d is CalendarDraft => d !== null);
    return { ok: true, drafts };
  } catch (e) {
    const kind = (e as { kind?: GoogleErrorKind }).kind ?? 'unknown';
    const msg = (e as Error).message;
    // Re-auth/scope errors carry a ready-to-show bilingual message.
    const show =
      kind === 'reauth' && msg ? msg : t(locale, 'imports.loadFailed');
    return { errorKind: kind, error: show };
  }
}

export type CalendarImportItem = {
  googleEventId: string;
  title: string;
  startISO: string;
  endISO: string | null;
  description: string | null;
  location: string | null;
  customerId: string;
};

/** Confirm selected calendar events as NEW job drafts.
 * Verifies every customerId belongs to this business, dedupes against
 * existing jobs (same business + same day + same title), then creates.
 */
export async function confirmCalendarImport(items: CalendarImportItem[]): Promise<ImportActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  const locale = await getLocale();

  // Business timezone: calendar events arrive in UTC; jobs are stored in
  // business-local day + time so the schedule buckets them correctly.
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });
  const tz = biz?.timezone || defaultTimezoneForRegion(biz?.regionCode);
  const zd = (iso: string) => zonedDayAndTime(new Date(iso), tz);

  const picked = items.filter((i) => i.customerId && i.title?.trim() && i.startISO);
  if (picked.length === 0) return { ok: true, imported: 0, skipped: 0 };

  // Verify every customerId belongs to this business — never invent customers.
  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true },
  });
  const customerIds = new Set(customers.map((c) => c.id));
  const bad = picked.some((i) => !customerIds.has(i.customerId));
  if (bad) return { error: t(locale, 'imports.importFailed') };

  // Dedupe: skip items that match an existing job on the same business-local
  // day with the same title.
  const dayKeys = [...new Set(picked.map((i) => zd(i.startISO).day))].sort();
  const windowStart = new Date(`${dayKeys[0]}T00:00:00`);
  const windowEnd = new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00`);
  windowEnd.setDate(windowEnd.getDate() + 1);
  const existing = await prisma.job.findMany({
    where: {
      businessId,
      date: { gte: windowStart, lt: windowEnd },
      status: { not: 'CANCELLED' },
    },
    select: { title: true, date: true },
  });
  const existingKeys = new Set(
    existing.map((j) => `${toISODateLocal(j.date)}|${j.title.trim().toLowerCase()}`)
  );

  const toCreate: CalendarImportItem[] = [];
  let skipped = 0;
  for (const i of picked) {
    const key = `${zd(i.startISO).day}|${i.title.trim().toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped += 1;
    } else {
      existingKeys.add(key); // also dedupe within this same import batch
      toCreate.push(i);
    }
  }

  if (toCreate.length > 0) {
    await prisma.job.createMany({
      data: toCreate.map((i) => {
        const { day, hhmm } = zd(i.startISO);
        const notes = [i.description?.trim(), i.location?.trim() ? `Location: ${i.location.trim()}` : '']
          .filter(Boolean)
          .join('\n')
          .slice(0, 2000);
        return {
          businessId,
          customerId: i.customerId,
          title: i.title.trim().slice(0, 200),
          date: localMidnight(day),
          time: hhmm,
          price: 0,
          address: i.location?.trim().slice(0, 300) || null,
          notes: notes || null,
          status: 'NEW',
        };
      }),
    });
  }

  revalidatePath('/imports');
  revalidatePath('/jobs');
  revalidatePath('/schedule');
  return { ok: true, imported: toCreate.length, skipped };
}

/** Parse + validate an uploaded CSV file server-side. Nothing is committed. */
export async function validateCsvImport(type: CsvType, text: string): Promise<ImportActionResult> {
  return validateRowsImport(type, parseCsv(text));
}

/**
 * Validate pre-parsed rows server-side (2026-09-24: Excel files are parsed
 * client-side with SheetJS into the same string[][] shape, then validated
 * through this shared path). Nothing is committed.
 */
export async function validateRowsImport(type: CsvType, rows: string[][]): Promise<ImportActionResult> {
  const { user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  if (!['customers', 'services', 'jobs'].includes(type)) return { error: 'Invalid type.' };
  const locale = await getLocale();
  const { valid, errors } = validateCsvRows(type, rows, locale === 'fr');
  return { ok: true, valid, errors };
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Commit validated CSV records. Validate-then-commit: ALL rows are checked
 * first (including job customer matching); when any row errors, nothing is
 * created. Job rows must match EXACTLY ONE customer by name (case-insensitive)
 * or phone within this business.
 */
export async function commitCsvImport(type: CsvType, records: CsvRecord[]): Promise<ImportActionResult> {
  const { businessId, user } = await requireAuth();
  const limited = await checkLimit(user.id);
  if (limited) return limited;
  if (!['customers', 'services', 'jobs'].includes(type)) return { error: 'Invalid type.' };
  const locale = await getLocale();
  const fr = locale === 'fr';

  if (type === 'customers' || type === 'services') {
    // Re-validate server-side: never trust the client preview.
    const { valid, errors } = validateCsvRows(type, [headerRowFor(type), ...recordsToRows(type, records)], fr);
    if (errors.length > 0) return { ok: false, errors };

    // Duplicate-import guard: importing the same file twice must not create
    // duplicates. Customers match on email when present (else name+phone);
    // services on name.
    const norm = (s: string) => s.trim().toLowerCase();
    let skipped = 0;
    let toCreate: typeof valid = valid;

    if (type === 'customers') {
      // 2026-09-24: duplicates are skipped by email when the row has one;
      // rows without an email fall back to normalized name+phone. The `seen`
      // set also covers rows already in this file, so importing the same
      // file twice (or a file with internal dupes) never double-creates.
      const existingCustomers = await prisma.customer.findMany({
        where: { businessId },
        select: { name: true, phone: true, email: true },
      });
      const seen = new Set(
        existingCustomers.map((c) => customerDedupeKey(c.name, c.phone, c.email))
      );
      toCreate = [];
      for (const r of valid) {
        const c = r as CustomerRecord;
        const key = customerDedupeKey(c.name, c.phone, c.email);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        toCreate.push(r);
      }
    } else {
      const existingServices = await prisma.service.findMany({
        where: { businessId },
        select: { name: true },
      });
      const seen = new Set(existingServices.map((s) => norm(s.name)));
      toCreate = [];
      for (const r of valid) {
        const s = r as ServiceRecord;
        const key = norm(s.name);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        toCreate.push(r);
      }
    }

    if (type === 'customers') {
      if (toCreate.length > 0) {
        await prisma.customer.createMany({
          data: toCreate.map((r) => {
            const c = r as CustomerRecord;
            return {
              businessId,
              name: c.name.slice(0, 200),
              phone: c.phone?.slice(0, 50) ?? null,
              email: c.email?.slice(0, 200) ?? null,
              address: c.address?.slice(0, 500) ?? null,
              notes: c.notes?.slice(0, 2000) ?? null,
            };
          }),
        });
      }
    } else {
      if (toCreate.length > 0) {
        await prisma.service.createMany({
          data: toCreate.map((r) => {
            const s = r as ServiceRecord;
            return {
              businessId,
              name: s.name.slice(0, 200),
              price: s.price,
              durationMin: s.durationMin,
              description: s.description?.slice(0, 500) ?? null,
            };
          }),
        });
      }
    }
    revalidatePath('/imports');
    revalidatePath(type === 'customers' ? '/customers' : '/pricebook');
    return { ok: true, imported: toCreate.length, skipped };
  }

  // Jobs: resolve customerMatch → exactly one customer, else row-level error.
  const existing = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true, phone: true, phoneNorm: true },
  });
  const errors: { row: number; message: string }[] = [];
  const resolved: { rec: JobRecord; customerId: string }[] = [];
  records.forEach((r, idx) => {
    const j = r as JobRecord;
    const q = (j.customerMatch ?? '').trim();
    const qDigits = digits(q);
    const matches = existing.filter(
      (c) =>
        c.name.trim().toLowerCase() === q.toLowerCase() ||
        (qDigits.length >= 7 &&
          (digits(c.phone ?? '') === qDigits || (c.phoneNorm ?? '') === qDigits))
    );
    if (matches.length !== 1) {
      errors.push({
        row: idx + 2,
        message:
          matches.length === 0
            ? (fr
                ? `Aucun client ne correspond à « ${q} ».`
                : `No customer matches "${q}".`)
            : (fr
                ? `Plusieurs clients correspondent à « ${q} ». Précisez le nom ou le téléphone.`
                : `Multiple customers match "${q}". Use a full name or phone number.`),
      });
    } else {
      resolved.push({ rec: j, customerId: matches[0].id });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  if (resolved.length > 0) {
    await prisma.job.createMany({
      data: resolved.map(({ rec, customerId }) => {
        const [hh, mm] = (rec.time ?? '09:00').split(':').map(Number);
        const [y, mo, d] = rec.date.split('-').map(Number);
        return {
          businessId,
          customerId,
          title: rec.title.slice(0, 200),
          date: new Date(Date.UTC(y, mo - 1, d, hh, mm)),
          time: rec.time ?? null,
          price: rec.price,
          address: rec.address?.slice(0, 500) ?? null,
          notes: rec.notes?.slice(0, 2000) ?? null,
          status: 'NEW',
        };
      }),
    });
  }
  revalidatePath('/imports');
  revalidatePath('/jobs');
  return { ok: true, imported: resolved.length };
}

/** Helpers to re-run server-side validation on the records the client sends back. */
const CSV_HEADERS: Record<CsvType, string[]> = {
  customers: ['name', 'phone', 'email', 'address', 'notes'],
  services: ['name', 'price', 'durationMin', 'description'],
  jobs: ['title', 'customer', 'date', 'time', 'price', 'address', 'notes'],
};

function headerRowFor(type: CsvType): string[] {
  return CSV_HEADERS[type];
}

function recordsToRows(type: CsvType, records: CsvRecord[]): string[][] {
  return records.map((r) => {
    if (type === 'customers') {
      const c = r as CustomerRecord;
      return [c.name, c.phone ?? '', c.email ?? '', c.address ?? '', c.notes ?? ''];
    }
    if (type === 'services') {
      const s = r as ServiceRecord;
      return [s.name, String(s.price), s.durationMin === null ? '' : String(s.durationMin), s.description ?? ''];
    }
    const j = r as JobRecord;
    return [j.title, j.customerMatch, j.date, j.time ?? '', String(j.price), j.address ?? '', j.notes ?? ''];
  });
}
