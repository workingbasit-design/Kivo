import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card } from '@/components/ui';
import TicketStatusButtons from './TicketStatusButtons';
import { formatDateShort, localeDateTag } from '@/lib/utils';
import { isProductOwner } from '@/lib/owner';
import { unsafeUnscoped } from '@/lib/tenant-guard';

export const metadata = { title: 'Support inbox | EveryJob' };

export default async function SupportInboxPage() {
  const { user } = await requireAuth();
  const locale = await getLocale();
  const dateLocale = localeDateTag(locale);
  const tr = (p: string) => t(locale, `support.${p}`);

  // The inbox holds tickets about the EveryJob product itself, so only the
  // product owner (OWNER_EMAILS) may see it. Everyone else gets a clear
  // notice instead of someone else's mail.
  if (!isProductOwner(user.email)) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader title={tr('inboxTitle')} subtitle={tr('inboxSub')} />
        <Card className="p-6">
          <p className="text-sm text-zinc-500">{tr('inboxRestricted')}</p>
        </Card>
      </div>
    );
  }

  // Owner support inbox (isProductOwner gate above): tickets about the
  // EveryJob product itself are global by design, not tenant data.
  const tickets = await unsafeUnscoped('support:ownerInbox', () =>
    prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
      },
    })
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={tr('inboxTitle')} subtitle={tr('inboxSub')} />
      {tickets.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-zinc-500">{tr('inboxEmpty')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{ticket.subject}</p>
                  <p className="text-xs text-zinc-500">
                    {ticket.name} ·{' '}
                    <a href={`mailto:${ticket.email}`} className="underline hover:text-zinc-800">
                      {ticket.email}
                    </a>{' '}
                    · {formatDateShort(ticket.createdAt, dateLocale)}
                  </p>
                </div>
                <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap bg-zinc-100 text-zinc-600 border-zinc-200">
                  {ticket.status === 'open'
                    ? tr('inboxOpen')
                    : ticket.status === 'answered'
                      ? tr('inboxAnswered')
                      : tr('inboxClosed')}
                </span>
              </div>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap mb-4">{ticket.message}</p>
              <TicketStatusButtons id={ticket.id} status={ticket.status} locale={locale} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
