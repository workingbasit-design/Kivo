'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { CA_PROVINCES, DEFAULT_CA_PROVINCE } from '@/lib/tax';
import {
  WEEK_DAYS,
  isValidTime,
  serializeWorkingHours,
  type WorkingHours,
} from '@/lib/working-hours';

export type SettingsResult = { error?: string; ok?: boolean };

const businessSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Business name is required').max(200),
  phone: z.string().trim().max(25).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  taxId: z
    .string()
    .trim()
    .max(15, 'GST/HST number is 15 characters (e.g. 123456789RT0001)')
    .refine((v) => v === '' || /^[0-9]{9}RT[0-9]{4}$/i.test(v), 'Enter a valid GST/HST number (e.g. 123456789RT0001)')
    .optional()
    .default(''),
  interacEmail: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email')
    .optional()
    .default(''),
  timezone: z.string().trim().max(60).optional().default(''),
  whatsappNumber: z
    .string()
    .trim()
    .max(25, 'WhatsApp number is too long')
    .refine(
      (v) => v === '' || /^[+\d][\d\s\-()]*$/.test(v),
      'Enter a valid WhatsApp number'
    )
    .optional()
    .default(''),
  directoryOptIn: z.coerce.boolean().default(true),
  directoryHideAddress: z.coerce.boolean().default(true),
  // taxRegion stores the Canadian province code ("ON").
  // Stored in the existing taxRegion column — no schema change needed.
  taxRegion: z.string().trim().max(10).optional().default(''),
});

const inviteMemberSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

function limited(key: string): SettingsResult | null {
  const rl = rateLimit(key, ACTION_LIMIT);
  if (!rl.ok) return { error: 'Too many requests. Please slow down.' };
  return null;
}

function requireAdminRole(role: string): SettingsResult | null {
  if (role !== 'ADMIN') return { error: 'Only admins can manage the team.' };
  return null;
}

/**
 * Parse the per-day working-hours inputs (wh_<day>_open / wh_<day>_close).
 * Returns the JSON string for storage, null when no day has hours, or
 * 'invalid' when any day is half-filled or has bad times.
 */
function parseWorkingHoursForm(formData: FormData): string | null | 'invalid' {
  const hours: WorkingHours = {};
  let any = false;
  for (const d of WEEK_DAYS) {
    const open = String(formData.get(`wh_${d.key}_open`) ?? '').trim();
    const close = String(formData.get(`wh_${d.key}_close`) ?? '').trim();
    if (!open && !close) continue;
    if (!isValidTime(open) || !isValidTime(close) || !(open < close)) {
      return 'invalid';
    }
    hours[d.key] = [open, close];
    any = true;
  }
  return any ? serializeWorkingHours(hours) : null;
}

/** Update business profile: name, phone, address, GST/HST number, Interac email, timezone, region + tax settings. */
export async function updateBusinessSettings(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const { businessId } = await requireAuth();
  const hit = limited(`settings:${businessId}`);
  if (hit) return hit;

  const parsed = businessSettingsSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    taxId: formData.get('taxId'),
    interacEmail: formData.get('interacEmail'),
    timezone: formData.get('timezone'),
    whatsappNumber: formData.get('whatsappNumber'),
    taxRegion: formData.get('taxRegion'),
    // Checkbox semantics: checked -> 'on' -> true; unchecked -> absent (null) -> false.
    // New businesses default to opted-in via the DB column default.
    directoryOptIn: formData.get('directoryOptIn'),
    directoryHideAddress: formData.get('directoryHideAddress'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid business details.' };
  }
  const { name, phone, address, taxId, interacEmail, timezone, whatsappNumber, directoryOptIn, directoryHideAddress } = parsed.data;

  // Per-day working hours from the wh_<day>_open / wh_<day>_close inputs.
  // A day with both fields empty is closed; any half-filled or invalid day
  // is a hard error so we never persist nonsense hours.
  const hours = parseWorkingHoursForm(formData);
  if (hours === 'invalid') {
    return { error: 'Working hours must be valid open/close times (open before close).' };
  }

  // Canada-only: province code for GST/HST/PST/QST; invalid values fall
  // back to Ontario instead of erroring.
  const province = parsed.data.taxRegion.toUpperCase();
  const taxRegion = CA_PROVINCES.some((p) => p.code === province)
    ? province
    : DEFAULT_CA_PROVINCE;
  const currency = 'CAD';

  await prisma.business.update({
    where: { id: businessId },
    data: {
      name,
      phone: phone || null,
      address: address || null,
      taxId: taxId ? taxId.toUpperCase() : null,
      interacEmail: interacEmail ? interacEmail.toLowerCase() : null,
      timezone: timezone || null,
      whatsappNumber: whatsappNumber || null,
      workingHours: hours,
      currency,
      taxRegion,
      directoryOptIn,
      directoryHideAddress,
    },
  });

  // Supply on day one: an opted-in business with no booking page gets one,
  // so its public directory profile has a stable link (/p/[slug]).
  if (directoryOptIn) {
    const existing = await prisma.bookingPage.findUnique({
      where: { businessId },
      select: { id: true },
    });
    if (!existing) {
      const { slugify } = await import('@/lib/slug');
      let base = slugify(name);
      let slug = base;
      for (let i = 2; i <= 20; i++) {
        const clash = await prisma.bookingPage.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!clash) break;
        slug = `${base}-${i}`;
      }
      await prisma.bookingPage.create({
        data: { businessId, slug, enabled: true },
      });
    }
  }

  revalidatePath('/settings');
  revalidatePath('/directory');
  return { ok: true };
}

/** Invite a team member (admin only). Creates a User under this business. */
export async function inviteTeamMember(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const { user, businessId } = await requireAuth();
  const notAdmin = requireAdminRole(user.role);
  if (notAdmin) return notAdmin;
  const hit = limited(`team:${businessId}`);
  if (hit) return hit;

  const parsed = inviteMemberSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid member details.' };
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'A user with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, role, businessId },
  });
  revalidatePath('/settings/team');
  return { ok: true };
}

/** Remove a team member (admin only). Cannot remove self or the last admin. */
export async function removeTeamMember(id: string): Promise<SettingsResult> {
  const { user, businessId } = await requireAuth();
  const notAdmin = requireAdminRole(user.role);
  if (notAdmin) return notAdmin;
  const hit = limited(`team:${businessId}`);
  if (hit) return hit;

  if (id === user.id) {
    return { error: 'You cannot remove yourself.' };
  }

  const target = await prisma.user.findFirst({ where: { id, businessId } });
  if (!target) return { error: 'Team member not found.' };

  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { businessId, role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      return { error: 'Cannot remove the last admin.' };
    }
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath('/settings/team');
  return { ok: true };
}

/**
 * Finish the onboarding "finish setup" checklist. Persists the WhatsApp
 * number and working hours on the business (previously a no-op).
 */
export async function completeBusinessSetup(opts: {
  whatsappNumber?: string;
  workingHoursJson?: string;
}): Promise<SettingsResult> {
  const { businessId } = await requireAuth();
  const hit = limited(`settings:${businessId}`);
  if (hit) return hit;

  const whatsappNumber = (opts.whatsappNumber ?? '').trim();
  if (
    whatsappNumber !== '' &&
    (whatsappNumber.length > 25 || !/^[+\d][\d\s\-()]*$/.test(whatsappNumber))
  ) {
    return { error: 'Enter a valid WhatsApp number.' };
  }

  // Validate the hours JSON before persisting so a bad modal value can't
  // corrupt the stored format.
  let workingHours: string | null = null;
  const rawHours = (opts.workingHoursJson ?? '').trim();
  if (rawHours) {
    try {
      const parsed = JSON.parse(rawHours) as Record<string, unknown>;
      const cleaned: Record<string, [string, string]> = {};
      for (const d of WEEK_DAYS) {
        const v = parsed[d.key];
        if (
          Array.isArray(v) &&
          v.length === 2 &&
          typeof v[0] === 'string' &&
          typeof v[1] === 'string' &&
          isValidTime(v[0]) &&
          isValidTime(v[1]) &&
          v[0] < v[1]
        ) {
          cleaned[d.key] = [v[0], v[1]];
        }
      }
      if (Object.keys(cleaned).length > 0) workingHours = JSON.stringify(cleaned);
    } catch {
      return { error: 'Invalid working hours.' };
    }
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      whatsappNumber: whatsappNumber || null,
      workingHours,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { ok: true };
}
