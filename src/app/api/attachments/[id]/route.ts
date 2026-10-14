import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/attachments/[id] - the ONLY way attachment bytes are served.
 *
 * B12: blobs are stored PRIVATE. The row is looked up tenant-scoped
 * ({ id, businessId }); the server then fetches the blob with the
 * BLOB_READ_WRITE_TOKEN and streams the bytes back. Raw Blob URLs are never
 * exposed, so one business cannot guess another's attachment URL, and there
 * is no public URL to share or index.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, businessId },
    select: { blobUrl: true, mimeType: true, fileName: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 });
  }
  // Private blob: server-side fetch with the token, stream to the client.
  // Legacy public blobs (uploaded before B12) are also fetchable this way.
  const upstream = await fetch(attachment.blobUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not load the file.' }, { status: 502 });
  }
  const safeName = attachment.fileName.replace(/["\r\n]/g, '_');
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
