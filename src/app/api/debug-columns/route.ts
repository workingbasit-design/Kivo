import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaUnscoped } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY QA ENDPOINT — reports real Postgres column types for money-ish
 * columns. Guarded by a one-time token. REMOVE BEFORE FINAL RELEASE.
 */
const TOKEN = 'qa-debug-9f3a7c2e1b5d4a8f';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rows = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string; data_type: string }>
  >(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('real', 'double precision', 'numeric')
     ORDER BY table_name, column_name`
  );

  // DB-layer round-trip probe: writes 99.99 via Prisma exactly like the
  // pricebook action does, reads it back via Prisma AND via raw SQL, then
  // deletes the probe row. ?probe=1 to run.
  let probe: unknown = null;
  if (req.nextUrl.searchParams.get('probe') === '1') {
    const biz = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Business" LIMIT 1`
    );
    const businessId = biz[0].id;
    const created = await prismaUnscoped.service.create({
      data: { name: 'DB Layer Probe', price: 99.99, businessId },
    });
    const viaPrisma = await prismaUnscoped.service.findUnique({
      where: { id: created.id },
      select: { price: true },
    });
    const viaSql = await prisma.$queryRawUnsafe<Array<{ price: number; t: string }>>(
      `SELECT price, price::text AS t FROM "Service" WHERE id = '${created.id}'`
    );
    await prismaUnscoped.service.delete({ where: { id: created.id } });
    const stillThere = await prismaUnscoped.service.findUnique({ where: { id: created.id } });
    probe = {
      wrote: '99.99',
      viaPrisma: viaPrisma ? String(viaPrisma.price) : null,
      viaSqlNumber: viaSql[0] ? String(viaSql[0].price) : null,
      viaSqlText: viaSql[0] ? viaSql[0].t : null,
      deleted: stillThere === null,
    };
  }
  // Zod+write pipeline probe: replicates the pricebook action's exact parse
  // path (FormData string -> serviceSchema -> prisma create -> read back).
  // ?zod=1 to run.
  let zodProbe: unknown = null;
  if (req.nextUrl.searchParams.get('zod') === '1') {
    const { serviceSchema } = await import('@/lib/validations');
    const fd = new FormData();
    fd.append('name', 'Zod Probe');
    fd.append('price', '99.99');
    const raw = fd.get('price');
    const coerced = Number(raw);
    const parsed = serviceSchema.safeParse({ name: fd.get('name'), price: raw });
    const biz = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Business" LIMIT 1`
    );
    let roundTrip: string | null = null;
    let cleaned = false;
    if (parsed.success) {
      const created = await prismaUnscoped.service.create({
        data: { name: 'Zod Probe', price: parsed.data.price, businessId: biz[0].id },
      });
      const back = await prismaUnscoped.service.findUnique({
        where: { id: created.id },
        select: { price: true },
      });
      roundTrip = back ? String(back.price) : null;
      await prismaUnscoped.service.delete({ where: { id: created.id } });
      cleaned = (await prismaUnscoped.service.findUnique({ where: { id: created.id } })) === null;
    }
    zodProbe = {
      raw: String(raw),
      rawType: typeof raw,
      coerced: String(coerced),
      parsedOk: parsed.success,
      parsedPrice: parsed.success ? String(parsed.data.price) : null,
      parsedType: parsed.success ? typeof parsed.data.price : null,
      roundTrip,
      cleaned,
      issues: parsed.success ? null : parsed.error.issues[0]?.message,
    };
  }
  // Booking-probe cleanup: finds the "Night Booking Probe" customer + jobs
  // created by the public-booking QA submit under slug e2e-phase7-shop
  // (belongs to a different business than the signed-in QA account) and
  // deletes them. ?cleanupbooking=1 to run.
  let bookingCleanup: unknown = null;
  if (req.nextUrl.searchParams.get('cleanupbooking') === '1') {
    const page = await prismaUnscoped.bookingPage.findUnique({
      where: { slug: 'e2e-phase7-shop' },
      select: { businessId: true, business: { select: { name: true } } },
    });
    if (!page) {
      bookingCleanup = { error: 'slug not found' };
    } else {
      const customers = await prismaUnscoped.customer.findMany({
        where: { businessId: page.businessId, name: 'Night Booking Probe' },
        select: { id: true, name: true, phone: true, notes: true },
      });
      const deleted: Array<{ customer: string; jobs: string[] }> = [];
      for (const c of customers) {
        const jobs = await prismaUnscoped.job.findMany({
          where: { businessId: page.businessId, customerId: c.id },
          select: { id: true, title: true, status: true },
        });
        await prismaUnscoped.job.deleteMany({
          where: { businessId: page.businessId, customerId: c.id },
        });
        await prismaUnscoped.customer.delete({
          where: { id: c.id },
        });
        deleted.push({ customer: `${c.name} (${c.phone})`, jobs: jobs.map((j) => `${j.title} [${j.status}]`) });
      }
      bookingCleanup = { business: page.business.name, deleted };
    }
  }
  // Artifact-input probe: what does the DEPLOYED server do when the client
  // sends an already-corrupted float32 string? ?artifactprobe=1 to run.
  let artifactProbe: unknown = null;
  if (req.nextUrl.searchParams.get('artifactprobe') === '1') {
    const { serviceSchema: ss } = await import('@/lib/validations');
    const inputs = ['99.98999786376952', '199.9900054931641', '19.989999771118164'];
    const results: Array<Record<string, unknown>> = [];
    for (const raw of inputs) {
      const parsed = ss.safeParse({ name: `Artifact Probe ${raw.slice(0, 6)}`, price: raw });
      let stored: string | null = null;
      let cleaned = false;
      if (parsed.success) {
        const created = await prismaUnscoped.service.create({
          data: { name: `Artifact Probe ${raw.slice(0, 6)}`, price: parsed.data.price, businessId: 'qa-probe-biz' },
          select: { id: true },
        });
        const rows2 = await prismaUnscoped.$queryRaw<Array<{ p: string }>>`
          SELECT price::text AS p FROM "Service" WHERE id = ${created.id}`;
        stored = rows2[0]?.p ?? null;
        await prismaUnscoped.service.delete({ where: { id: created.id } });
        cleaned = true;
      }
      results.push({
        raw,
        parsedOk: parsed.success,
        parsedPrice: parsed.success ? String(parsed.data.price) : null,
        storedRaw: stored,
        cleaned,
      });
    }
    artifactProbe = { results };
  }
  return NextResponse.json({ rows, probe, zodProbe, bookingCleanup, artifactProbe });
}
