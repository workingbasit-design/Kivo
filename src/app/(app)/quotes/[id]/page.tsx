import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { formatDateShort, localeDateTag, localeMoneyTag } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { getTaxConfig, totalTaxRate } from '@/lib/tax';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import RevokeSignButton from './RevokeSignButton';
import {
  getQuoteShareState,
  regenerateQuoteShareLink,
  revokeQuoteShareLink,
  setQuoteShareLinkExpiry,
} from '@/app/actions/quotes';
import QuoteActions from './QuoteActions';
import QuoteAddons from './QuoteAddons';
import ShareTokenManager from '@/components/ShareTokenManager';
import WhatsAppButton from '@/components/WhatsAppButton';

const round2 = (n: number) => Math.round(n * 100) / 100;

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      business: { select: { regionCode: true, taxRegion: true, currency: true, name: true } },
      addons: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!quote) notFound();

  const shareState = await getQuoteShareState(quote.id);

  const locale = await getLocale();
  const dateLocale = localeDateTag(locale);
  const moneyLocale = localeMoneyTag(locale);
  const L = (path: string) => t(locale, path);

  const currency = 'CAD';
  const taxConfig = getTaxConfig(
    quote.business.regionCode,
    quote.business.taxRegion
  );
  const rate = totalTaxRate(taxConfig);

  // The stored total is tax-inclusive (see createQuote). Back out the tax
  // lines so they sum exactly to the total.
  const taxAmount = rate > 0 ? round2((quote.total * rate) / (100 + rate)) : 0;
  const subtotal = round2(quote.total - taxAmount);
  const taxLines = taxConfig.taxes.map((t) => ({
    ...t,
    amount:
      taxConfig.taxes.length === 1
        ? taxAmount
        : round2((subtotal * t.rate) / 100),
  }));
  // Fix rounding drift on multi-tax configs so lines sum to taxAmount.
  if (taxLines.length > 1) {
    const sum = round2(taxLines.reduce((s, l) => s + l.amount, 0));
    taxLines[taxLines.length - 1].amount = round2(
      taxLines[taxLines.length - 1].amount + (taxAmount - sum)
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to quotes
      </Link>

      <PageHeader
        title={`${quote.number} · ${quote.title}`}
        subtitle={`Created ${formatDateShort(quote.createdAt, dateLocale)}`}
        actions={<StatusBadge status={quote.status} />}
      />

      <Card className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">{quote.customer.name}</p>
              <p className="text-xs text-zinc-500">
                {[quote.customer.phone, quote.customer.address].filter(Boolean).join(' · ') || 'No contact details'}
              </p>
              {/* wa.me chat with the customer — user taps to send from their
                  own WhatsApp; EveryJob never sends anything automatically. */}
              <div className="mt-2">
                <WhatsAppButton
                  phone={quote.customer.phone}
                  regionCode={quote.business.regionCode}
                  message={`Hi ${quote.customer.name}! ${quote.business.name ?? 'We'} prepared quote ${quote.number} (${quote.title}) for you — total ${formatMoney(quote.total, currency, moneyLocale)}. Just reply if you have any questions.`}
                  label="WhatsApp"
                />
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatMoney(quote.total, currency, moneyLocale)}</p>
        </div>

        <dl className="border-t border-zinc-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatMoney(subtotal, currency, moneyLocale)}</dd>
          </div>
          {taxLines.map((l) => (
            <div key={l.name} className="flex justify-between text-zinc-600">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(l.amount, currency, moneyLocale)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-base pt-1">
            <dt className="font-bold text-zinc-900">Total</dt>
            <dd className="font-bold text-zinc-900">{formatMoney(quote.total, currency, moneyLocale)}</dd>
          </div>
        </dl>

        <div className="border-t border-zinc-100 pt-5 space-y-3">
          <QuoteActions id={quote.id} status={quote.status} />
          <Link
            href={`/quotes/${quote.id}/sign`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            {L('esign.sendForSignature')}
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <QuoteAddons
          quoteId={quote.id}
          status={quote.status}
          currency={currency}
          addons={quote.addons.map((a) => ({
            id: a.id,
            title: a.title,
            price: a.price,
            selected: a.selected,
          }))}
          strings={{
            title: L('quotes.addons.title'),
            hint: L('quotes.addons.hint'),
            add: L('quotes.addons.add'),
            nameLabel: L('quotes.addons.nameLabel'),
            priceLabel: L('quotes.addons.priceLabel'),
            edit: L('quotes.addons.edit'),
            save: L('quotes.addons.save'),
            cancel: L('quotes.addons.cancel'),
            delete: L('quotes.addons.delete'),
            deleteConfirm: L('quotes.addons.deleteConfirm'),
            empty: L('quotes.addons.empty'),
            locked: L('quotes.addons.locked'),
            errorInvalid: L('quotes.addons.errorInvalid'),
          }}
        />
      </Card>

      <SignatureRequestsCard quoteId={quote.id} L={L} locale={locale} />

      <Card className="p-6">
        <ShareTokenManager
          kind="quote"
          docId={quote.id}
          initial={shareState}
          regenerateAction={regenerateQuoteShareLink}
          revokeAction={revokeQuoteShareLink}
          setExpiryAction={setQuoteShareLinkExpiry}
        />
      </Card>

      <p className="text-[11px] text-zinc-400">
        {taxConfig.label} is included in this quote, based on your region settings
        (Settings → Region & tax).
      </p>
    </div>
  );
}

/** EveryJob Sign status: signing links for this quote, audit trail included. */
async function SignatureRequestsCard({
  quoteId,
  L,
  locale,
}: {
  quoteId: string;
  L: (path: string) => string;
  locale: string;
}) {
  const dateLocale = localeDateTag(locale);
  const session = await getSession();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const requests = await prisma.signatureRequest.findMany({
    where: { quoteId, businessId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      signedAt: true,
      signerName: true,
      auditJson: true,
    },
  });
  if (requests.length === 0) return null;

  const STATUS_LABELS: Record<string, string> = {
    sent: L('esign.statusSent'),
    viewed: L('esign.statusViewed'),
    signed: L('esign.statusSigned'),
    declined: L('esign.statusDeclined'),
    expired: L('esign.statusExpired'),
    revoked: L('esign.statusRevoked'),
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-sm font-bold text-zinc-900">{L('esign.status')}</h3>

      {requests.map((req) => {
        const revocable = req.status === 'sent' || req.status === 'viewed';
        let audit: { event: string; at: string; ip: string }[] = [];
        try {
          const parsed: unknown = JSON.parse(req.auditJson);
          if (Array.isArray(parsed)) audit = parsed;
        } catch {
          audit = [];
        }

        return (
          <div key={req.id} className="border-t border-zinc-100 pt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={STATUS_LABELS[req.status] ?? req.status} />
                <span className="text-xs text-zinc-500">
                  {formatDateShort(req.createdAt, dateLocale)}
                </span>
                {req.signedAt && (
                  <span className="text-xs text-zinc-500">
                    · {L('esign.statusSigned')} {formatDateShort(req.signedAt, dateLocale)}
                  </span>
                )}
                {req.signerName && (
                  <span className="text-xs font-semibold text-zinc-700">
                    · {req.signerName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {req.status === 'signed' && (
                  <Link
                    href={`/quotes/${quoteId}/sign/${req.id}/print`}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    {L('esign.downloadSigned')}
                  </Link>
                )}
                {revocable && (
                  <RevokeSignButton
                    requestId={req.id}
                    confirmText={L('esign.confirmRevoke')}
                    revokeText={L('esign.revoke')}
                    revokedText={L('esign.revoked')}
                    cancelText={L('common.cancel')}
                  />
                )}
              </div>
            </div>

            {audit.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-zinc-500 hover:text-zinc-700">
                  {L('esign.auditTitle')}
                </summary>
                <ul className="mt-1.5 space-y-1 text-zinc-500">
                  {audit.map((a, i) => (
                    <li key={i} className="font-mono">
                      {a.event} · {a.at}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-zinc-400">{L('esign.legalLine')}</p>
    </Card>
  );
}
