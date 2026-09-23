import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/attachments/[id] — the ONLY way attachment bytes are served.
 *
 * The row is looked up tenant-scoped ({ id, businessId }); the client is
 * then redirected to the signed Blob URL. Raw Blob URLs are never handed
 * out cross-tenant, so one business cannot guess another's attachment id.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, businessId },
    select: { blobUrl: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.redirect(attachment.blobUrl);
}
