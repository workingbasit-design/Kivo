import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { publicClientIp } from '@/lib/directory';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { isProductOwner } from '@/lib/owner';

/**
 * Public support ticket intake.
 *
 * - Rate-limited like other public, spam-prone endpoints (5/hour/IP).
 * - Validates with zod; never trusts client input.
 * - Attaches the submitter's businessId when they are signed in (tenant
 *   context for the owner); works fine logged out too.
 * - The ticket is ALWAYS stored in the DB (status 'open').
 * - Owner notification is best-effort and optional: if the owner configures
 *   SUPPORT_OWNER_EMAIL (+ RESEND_API_KEY, Resend free tier), a plain-text
 *   email is sent. Nothing is added that costs money, and a notification
 *   failure never fails the ticket itself.
 */
export const runtime = 'nodejs';

const TICKET_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 tickets / hour / IP

const ticketSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).email(),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(5000),
});

async function notifyOwner(ticket: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  const ownerEmail = process.env.SUPPORT_OWNER_EMAIL?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!ownerEmail || !resendKey) return; // not configured — ticket still stored
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EveryJob Support <support@everyjob.ca>',
        to: [ownerEmail],
        subject: `[EveryJob ticket] ${ticket.subject}`,
        text: `New support ticket\n\nFrom: ${ticket.name} <${ticket.email}>\nSubject: ${ticket.subject}\n\n${ticket.message}`,
      }),
    });
  } catch {
    // Best-effort only: the ticket is already stored.
  }
}

export async function POST(req: Request) {
  const ip = await publicClientIp();
  const rl = rateLimit(`support-ticket:${ip}`, TICKET_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ticketSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.issues.map((i) => i.path.join('.')) },
      { status: 400 }
    );
  }

  // Optional tenant context — the form is public, so never require auth.
  const session = await getSession();
  const businessId: string | null = session?.user?.businessId ?? null;

  const d = parsed.data;
  await prisma.supportTicket.create({
    data: {
      businessId,
      name: d.name,
      email: d.email,
      subject: d.subject,
      message: d.message,
      status: 'open',
    },
  });

  await notifyOwner(d);

  return NextResponse.json({ ok: true });
}

const statusSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(['open', 'answered', 'closed']),
});

/** Owner-only: update a ticket's status from the inbox. */
export async function PATCH(req: Request) {
  // Same-origin check: mutating API routes don't get Next.js's server-action
  // CSRF protection (see src/lib/csrf.ts).
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();
  let email: string | null = null;
  const patchSession = await getSession();
  if (!patchSession?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  email = patchSession.user.email;
  // Only the product owner may change ticket statuses. Tickets are about the
  // EveryJob product itself, not tenant data — fail closed until OWNER_EMAILS
  // is configured.
  if (!isProductOwner(email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = statusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  // Tickets may be global (no businessId) — the owner inbox sees all of them.
  const ticket = await prisma.supportTicket.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: ticket.id });
}
