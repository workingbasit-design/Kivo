import { headers } from 'next/headers';
import { CheckCircle2, Clock, FileText, MessageCircle, Phone, XCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { isLegacyCuid, resolveShareToken } from '@/lib/share';
import { waLink } from '@/lib/whatsapp';
import { Card, StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { addonQuoteTotal } from '@/lib/quotes';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import QuotePortalActions from '@/components/QuotePortalActions';
import PortalNotice from '@/components/PortalNotice';

/**
 * Public client portal for a quote. No authentication — the share token in
 * the URL is the only capability. The page loads exactly one quote and its
 * own business/customer, nothing else.
 */

const PORTAL_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

export default async function QuotePortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const rl = rateLimit(`portal:quote:${await clientIp()}`, PORTAL_LIMIT);
  if (!rl.ok) return <PortalNotice variant="rate-limited" />;

  // Old cuid-based links are retired — friendly message, no data lookup.
  if (isLegacyCuid(token)) return <PortalNotice variant="legacy" />;

  const resolved = await resolveShareToken(token, 'QUOTE');
  if (!resolved.ok) return <PortalNotice variant="expired" />;

  const quote = await prisma.quote.findFirst({
    where: {
      id: resolved.rec.quoteId ?? undefined,
      businessId: resolved.rec.businessId,
    },
    select: {
      id: true,
      number: true,
      title: true,
      total: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true } },
      addons: {
        select: { id: true, title: true, price: true, selected: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      business: {
        select: {
          name: true,
          phone: true,
          whatsappNumber: true,
          address: true,
          regionCode: true,
          currency: true,
        },
      },
    },
  });

  if (!quote) return <PortalNotice variant="expired" />;

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  const selectedAddons = quote.addons.filter((a) => a.selected);
  const approvedTotal =
    selectedAddons.length > 0 ? addonQuoteTotal(quote.total, quote.addons) : quote.total;

  const whatsappHref = waLink(
    quote.business.whatsappNumber || quote.business.phone,
    `Hi ${quote.business.name}! I have a question about quote ${quote.number}.`,
    quote.business.regionCode
  );

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans">
      <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <div className="w-11 h-11 rounded-xl bg-[#6329d4] flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">{quote.business.name}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Quote for {quote.customer.name}</p>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{quote.number}</p>
              <h2 className="text-lg font-bold text-zinc-900 mt-0.5">{quote.title}</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Issued {quote.createdAt.toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge status={quote.status} />
          </div>

          <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
            <span className="text-sm text-zinc-500">Total</span>
            <span className="text-2xl font-bold text-zinc-900 tracking-tight">{formatMoney(quote.total, quote.business.currency)}</span>
          </div>
        </Card>

        {quote.status === 'SENT' ? (
          <Card className="p-6">
            <QuotePortalActions
              token={token}
              addons={quote.addons}
              baseTotal={quote.total}
              currency={quote.business.currency}
              strings={{
                addonsTitle: L('quotes.portal.addonsTitle'),
                addonsHint: L('quotes.portal.addonsHint'),
                baseTotal: L('quotes.portal.baseTotal'),
                yourTotal: L('quotes.portal.yourTotal'),
              }}
            />
          </Card>
        ) : (
          <Card className="p-6 text-center">
            {quote.status === 'APPROVED' ? (
              <>
                <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-900">You approved this quote.</p>
                {selectedAddons.length > 0 && (
                  <div className="text-left mt-4 border-t border-smoke pt-4">
                    <p className="text-xs font-bold text-ink mb-2">
                      {L('quotes.portal.includedAddons')}
                    </p>
                    <ul className="space-y-1.5">
                      {selectedAddons.map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-graphite">{a.title}</span>
                          <span className="font-semibold text-ink">
                            +{formatMoney(a.price, quote.business.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-smoke mt-3 pt-3">
                      <span className="text-sm font-bold text-ink">{L('quotes.portal.yourTotal')}</span>
                      <span className="text-lg font-bold text-ink tracking-tight">
                        {formatMoney(approvedTotal, quote.business.currency)}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-3">The business will be in touch to schedule the work.</p>
              </>
            ) : quote.status === 'DECLINED' ? (
              <>
                <XCircle size={32} className="mx-auto text-zinc-400 mb-2" />
                <p className="text-sm font-semibold text-zinc-900">You declined this quote.</p>
                <p className="text-xs text-zinc-500 mt-1">No problem — contact the business if you change your mind.</p>
              </>
            ) : (
              <>
                <Clock size={32} className="mx-auto text-zinc-400 mb-2" />
                <p className="text-sm font-semibold text-zinc-900">This quote isn&apos;t ready yet.</p>
                <p className="text-xs text-zinc-500 mt-1">Please check back once the business sends it.</p>
              </>
            )}
          </Card>
        )}

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-sm py-3 rounded-2xl transition-colors"
          >
            <MessageCircle size={16} /> Questions? Chat on WhatsApp
          </a>
        )}

        {quote.business.phone && (
          <p className="text-center">
            <a
              href={`tel:${quote.business.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6329d4]"
            >
              <Phone size={15} /> {quote.business.phone}
            </a>
          </p>
        )}
      </main>
    </div>
  );
}
