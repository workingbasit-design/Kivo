import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/expenses/receipt/[id] - tenant-scoped receipt image serving.
 *
 * B12: receipt blobs are stored PRIVATE. The expense row is looked up
 * tenant-scoped ({ id, businessId }); the server fetches the blob with the
 * BLOB_READ_WRITE_TOKEN and streams the bytes. The raw Blob URL is never
 * rendered to the client (ExpenseForm uses this route as the img src).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  const businessId = membership?.businessId;
  if (!session || !businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const expense = await prisma.jobExpense.findFirst({
    where: { id, businessId },
    select: { receiptUrl: true },
  });
  if (!expense?.receiptUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 });
  }
  const upstream = await fetch(expense.receiptUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not load the file.' }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
