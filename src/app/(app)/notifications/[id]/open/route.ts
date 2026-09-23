import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { markNotificationRead } from '@/lib/notifications';

/**
 * Click-through for a notification: marks it read, then sends the user to
 * the underlying record. The href is validated to be an in-app path so a
 * tampered row can never become an open redirect.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { businessId } = await requireAuth();
  const { id } = await params;

  const n = await prisma.notification.findFirst({
    where: { id, businessId },
    select: { href: true },
  });
  if (!n) redirect('/notifications');

  await markNotificationRead(id, businessId);

  const href = n.href && n.href.startsWith('/') && !n.href.startsWith('//') ? n.href : '/notifications';
  redirect(href);
}
