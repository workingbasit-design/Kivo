import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCustomerAuth } from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { ArrowLeft, BadgeCheck, Send } from '@/components/icons';
import { sendCustomerMessage } from '@/app/actions/customer-requests';
import { cn } from '@/lib/utils';
import { Card } from '@/components/kit';

export default async function CustomerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCustomerAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);
  const { id } = await params;

  const req = await prisma.quoteRequest.findFirst({
    where: { id, customerId: session.customer.id },
    include: {
      business: { select: { name: true, logoUrl: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!req) notFound();

  return (
    <div className="space-y-4">
      <div className="ej-anim-fade-up">
        <Link
          href="/customer/requests"
          className="group inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink min-h-[44px] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          {tr('customer.quote.myRequests')}
        </Link>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '60ms' }}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid w-[42px] h-[42px] place-items-center rounded-full bg-surface-2 ring-1 ring-inset ring-line font-bold text-ink text-[15px] flex-none overflow-hidden"
            >
              {req.business.logoUrl ? (
                <img src={req.business.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                req.business.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[15px] text-ink truncate">{req.business.name}</h1>
                <BadgeCheck className="w-4 h-4 text-info shrink-0" />
              </div>
              <p className="text-xs text-ink-2">
                {req.service} · {tr(`customer.requests.status.${req.status}`)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '120ms' }}>
        <Card className="p-4 space-y-3 min-h-[200px]">
          {req.messages.map((msg) => {
            const mine = msg.senderType === 'customer';
            return (
              <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-[18px] px-[14px] py-[11px] text-[16px] leading-[1.45]',
                    mine
                      ? 'bg-ink text-surface rounded-br-[6px]'
                      : 'bg-surface-2 text-ink rounded-bl-[6px] border border-line'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p className={cn('text-[10px] mt-1', mine ? 'text-surface/70' : 'text-ink-2')}>
                    {new Date(msg.createdAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <form action={sendCustomerMessage} className="ej-anim-fade-up flex gap-2" style={{ animationDelay: '180ms' }}>
        <input type="hidden" name="requestId" value={req.id} />
        <input
          name="body"
          required
          maxLength={2000}
          placeholder={tr('customer.quote.writeMessage')}
          aria-label={tr('customer.quote.sendMessage')}
          className="input flex-1"
        />
        <button
          type="submit"
          aria-label={tr('customer.quote.sendMessage')}
          className="w-[52px] h-[52px] rounded-full bg-hivis text-hivis-ink inline-flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
