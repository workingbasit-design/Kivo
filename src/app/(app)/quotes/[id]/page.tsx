import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, User } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { Button, Card } from '@/components/kit';
import { localeMoneyTag, toISODateInTimezone } from '@/lib/utils';
import { formatMoney, centsToDollars } from '@/lib/money';
import { lineMargin, summarizeLineMargins } from '@/lib/line-margin';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { getTaxConfig, totalTaxRate } from '@/lib/tax';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import MoneyExplainer from '@/components/MoneyExplainer';
import {
  buildQuoteExplainerLines,
  buildExplainerStrings,
} from '@/lib/money-explainer';
import RevokeSignButton from './RevokeSignButton';
import {
  getQuoteShareState,
  regenerateQuoteShareLink,
  revokeQuoteShareLink,
  setQuoteShareLinkExpiry,
} from '@/app/actions/quotes';
import { convertedJobNotesPrefix } from '@/lib/quotes';
import QuoteActions from './QuoteActions';
import QuoteAddons from './QuoteAddons';
import ShareTokenManager from '@/components/ShareTokenManager';
import WhatsAppButton from '@/components/WhatsAppButton';
import SmsButton from '@/components/SmsButton';
import QuoteDepositCard from '@/components/QuoteDepositCard';
import QuoteItemsEditor from './QuoteItemsEditor';
import QuoteExpiryEditor from './QuoteExpiryEditor';
import { isQuoteExpired } from '@/lib/quote-expiry';
import RecordDepositForm from '@/components/RecordDepositForm';
import RecordLastOpened from '@/components/RecordLastOpened';
import { StatusPill } from '../../_components/status-ui';
import { PageTitle } from '../../_components/PageTitle';

const round2 = (n: number) => Math.round(n * 100) / 100;

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: line items, deposits and the tax-inclusive total are
  // money data. Viewers without the capability (technicians) are bounced
  // to their dashboard before the quote is loaded.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      business: { select: { regionCode: true, taxRegion: true, currency: true, name: true, timezone: true } },
      addons: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      lineItems: { orderBy: { position: 'asc' } },
      deposits: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!quote) notFound();

  const shareState = await getQuoteShareState(quote.id);

  // Duplicate-conversion guard (2026-10-19 morning QA): a converted quote
  // keeps APPROVED status, so without this the "Convert to job" button
  // stays mounted and a second click silently creates a duplicate job.
  // The job carries the canonical "Converted from quote <number>." notes
  // marker (quote numbers are unique per business).
  const convertedJob = await prisma.job.findFirst({
    where: {
      businessId,
      notes: { startsWith: convertedJobNotesPrefix(quote.number) },
    },
    select: { id: true },
  });

  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const L = (path: string) => t(locale, path);

  // Slice 5: derived via the helper (react-hooks/purity forbids a direct
  // Date.now() in render; a helper call like followupThreshold is the
  // codebase's accepted shape for this).
  const expired = isQuoteExpired(quote);

  const currency = 'CAD';
  const taxConfig = getTaxConfig(
    quote.business.regionCode,
    quote.business.taxRegion
  );
  const rate = totalTaxRate(taxConfig);

  // The stored total is tax-inclusive (see createQuote). Back out the tax
  // lines so they sum exactly to the total.
  const totalDollars = centsToDollars(quote.totalCents);
  const taxAmount = rate > 0 ? round2((totalDollars * rate) / (100 + rate)) : 0;
  const taxable = round2(totalDollars - taxAmount);
  // Track 8D quotes persist their line items; older quotes only have a total.
  const hasLineItems = quote.lineItems.length > 0;
  const itemsSubtotal = round2(
    quote.lineItems.reduce((s, i) => s + i.qty * centsToDollars(i.unitPriceCents), 0)
  );
  const subtotal = hasLineItems ? itemsSubtotal : taxable;
  const discountAmount = hasLineItems
    ? round2(Math.max(0, itemsSubtotal - taxable))
    : 0;
  const showDiscount =
    hasLineItems && quote.discountType != null && discountAmount > 0;
  const discountLabel =
    L('quoteItems.discount') +
    (quote.discountType === 'PERCENT' && quote.discountValue != null
      ? ` (${quote.discountValue}%)`
      : '');
  const taxLines = taxConfig.taxes.map((t) => ({
    ...t,
    amount:
      taxConfig.taxes.length === 1
        ? taxAmount
        : round2((taxable * t.rate) / 100),
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
      <RecordLastOpened kind="quote" id={quote.id} title={quote.title} subtitle={quote.customer.name} />
      <Link
        href="/quotes"
        className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to quotes
      </Link>

      <PageTitle
        title={`${quote.number} · ${quote.title}`}
        summary={<>Created <DateTimeText date={quote.createdAt} variant="short" timezone={quote.business.timezone ?? 'America/Toronto'} locale={locale} /></>}
      />
      <div className="flex flex-wrap gap-2">
        <StatusPill status={quote.status} locale={locale} />
        <Button
          href={`/quotes/templates/new?fromQuote=${quote.id}`}
          variant="secondary"
        >
          {t(locale, 'quotes.templates.saveAsTemplate')}
        </Button>
      </div>

      {/* Slice 5: validity display + editor (DRAFT/SENT only). Expiry is
          derived: only a SENT quote with a past expiresAt is Expired. */}
      {quote.expiresAt && (
        <p className="text-sm text-ink-2">
          {t(locale, 'quotes.expiry.validUntil')}{' '}
          <DateTimeText date={quote.expiresAt} variant="short" timezone={quote.business.timezone ?? 'America/Toronto'} locale={locale} />
          {quote.status === 'SENT' && expired && (
            <span className="text-danger font-semibold"> · {t(locale, 'quotes.expiry.expired')}</span>
          )}
        </p>
      )}
      {(quote.status === 'DRAFT' || quote.status === 'SENT') && (
        <QuoteExpiryEditor
          quoteId={quote.id}
          initialDateKey={
            quote.expiresAt
              ? toISODateInTimezone(quote.expiresAt, quote.business.timezone ?? 'America/Toronto')
              : ''
          }
          locale={locale}
        />
      )}

      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-2 text-ink-2 flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">{quote.customer.name}</p>
              <p className="text-xs text-ink-2">
                {[quote.customer.phone, quote.customer.address].filter(Boolean).join(' · ') || 'No contact details'}
              </p>
              {/* wa.me chat with the customer - user taps to send from their
                  own WhatsApp; EveryJob never sends anything automatically. */}
              <div className="mt-2">
                <WhatsAppButton
                  phone={quote.customer.phone}
                  regionCode={quote.business.regionCode}
                  message={`Hi ${quote.customer.name}! ${quote.business.name ?? 'We'} prepared quote ${quote.number} (${quote.title}) for you - total ${formatMoney(centsToDollars(quote.totalCents), currency, moneyLocale)}. Just reply if you have any questions.`}
                  label="WhatsApp"
                />
                <SmsButton
                  phone={quote.customer.phone}
                  regionCode={quote.business.regionCode}
                  message={`Hi ${quote.customer.name}! ${quote.business.name ?? 'We'} prepared quote ${quote.number} (${quote.title}) for you - total ${formatMoney(centsToDollars(quote.totalCents), currency, moneyLocale)}. Just reply if you have any questions.`}
                  label="SMS"
                />
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-ink sm:text-right tabular-nums"><MoneyText dollars={centsToDollars(quote.totalCents)} locale={locale} /></p>
        </div>

        {hasLineItems && (
          <div className="border-t border-line pt-4">
            <h2 className="text-sm font-bold text-ink mb-1">{L('quoteItems.title')}</h2>
            <ul className="mt-2 space-y-2">
              {quote.lineItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-line bg-surface-2/50 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-ink">{item.description}</p>
                  <p className="text-xs text-ink-2 mt-1 tabular-nums">
                    {item.qty} × <MoneyText dollars={centsToDollars(item.unitPriceCents)} locale={locale} />
                    <span className="font-bold text-ink">
                      {' '}· <MoneyText dollars={round2(item.qty * centsToDollars(item.unitPriceCents))} locale={locale} />
                    </span>
                  </p>
                  {(() => {
                    // Slice 3: cost/margin line, pro-only page (SEE_PRICES
                    // gate above) and never printed — the pro prints this
                    // document for the customer.
                    const m = lineMargin({
                      qty: item.qty,
                      unitPriceCents: item.unitPriceCents,
                      unitCostCents: item.unitCostCents,
                    });
                    if (!m) return null;
                    return (
                      <p className="text-xs text-ink-2 mt-1 tabular-nums print:hidden">
                        {L('t10money.costLabel')}:{' '}
                        <MoneyText dollars={centsToDollars(m.costCents)} locale={locale} />
                        {' '}· {L('t10money.lineMarginLabel')}:{' '}
                        <span className="font-semibold text-ink">
                          <MoneyText dollars={centsToDollars(m.marginCents)} locale={locale} />
                          {m.marginPct !== null ? ` (${Math.round(m.marginPct)}%)` : ''}
                        </span>
                      </p>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="border-t border-line pt-4 space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between text-ink-2">
            <dt>{L('t10money.subtotalLabel')}</dt>
            <dd className="font-semibold"><MoneyText dollars={subtotal} locale={locale} /></dd>
          </div>
          {showDiscount && (
            <div className="flex justify-between text-ok">
              <dt>{discountLabel}</dt>
              <dd className="font-semibold">−<MoneyText dollars={discountAmount} locale={locale} /></dd>
            </div>
          )}
          {taxLines.map((l) => (
            <div key={l.name} className="flex justify-between text-ink-2">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold"><MoneyText dollars={l.amount} locale={locale} /></dd>
            </div>
          ))}
          <div className="flex justify-between items-center text-base bg-asphalt text-hero-ink rounded-xl px-4 py-3 -mx-1 mt-2">
            <dt className="font-bold">{L('t10money.totalLabel')}</dt>
            <dd className="font-bold"><MoneyText dollars={centsToDollars(quote.totalCents)} locale={locale} /></dd>
          </div>
        </dl>

        {(() => {
          // Slice 3 margin summary: costed lines only, never printed.
          const summary = summarizeLineMargins(
            quote.lineItems.map((item) => ({
              qty: item.qty,
              unitPriceCents: item.unitPriceCents,
              unitCostCents: item.unitCostCents,
            }))
          );
          if (summary.costedLines === 0) return null;
          return (
            <div className="border-t border-line pt-4 mt-4 space-y-1.5 text-sm tabular-nums print:hidden">
              <div className="flex justify-between text-ink-2">
                <span>{L('t10money.marginCostLabel')}</span>
                <span className="font-semibold"><MoneyText dollars={centsToDollars(summary.costCents)} locale={locale} /></span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>{L('t10money.lineMarginLabel')}</span>
                <span className="font-semibold">
                  <MoneyText dollars={centsToDollars(summary.marginCents)} locale={locale} />
                  {summary.marginPct !== null ? ` (${Math.round(summary.marginPct)}%)` : ''}
                </span>
              </div>
              {summary.costedLines < summary.totalLines && (
                <p className="text-xs text-ink-2">
                  {L('t10money.marginCoverage')
                    .replace('{costed}', String(summary.costedLines))
                    .replace('{total}', String(summary.totalLines))}
                </p>
              )}
            </div>
          );
        })()}

        <MoneyExplainer
          title={L('explainer.title')}
          lines={buildQuoteExplainerLines({
            subtotal: formatMoney(subtotal, currency, moneyLocale),
            discount: showDiscount
              ? { label: discountLabel, amount: formatMoney(discountAmount, currency, moneyLocale) }
              : null,
            taxes: taxLines.map((l) => ({
              name: l.name,
              rate: l.rate,
              amount: formatMoney(l.amount, currency, moneyLocale),
            })),
            total: formatMoney(centsToDollars(quote.totalCents), currency, moneyLocale),
            status: quote.status,
            strings: buildExplainerStrings((k) => L(`explainer.${k}`)),
          })}
        />

        <div className="border-t border-line pt-5 space-y-3">
          <QuoteActions
            id={quote.id}
            status={quote.status}
            locale={locale}
            convertedJobId={convertedJob?.id ?? null}
          />
          <Link
            href={`/quotes/${quote.id}/sign`}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-bold text-info hover:text-info"
          >
            {L('esign.sendForSignature')}
          </Link>
        </div>
      </Card>

      {/* Draft-only: edit line items + discount; the server recomputes the total. */}
      {quote.status === 'DRAFT' && (
        <QuoteItemsEditor
          quoteId={quote.id}
          locale={locale}
          initial={{
            items: quote.lineItems.map((item) => ({
              desc: item.description,
              qty: String(item.qty),
              rate: String(centsToDollars(item.unitPriceCents)),
              // Slice 3: null cost stays blank — centsToDollars(null) is 0,
              // which would silently rewrite "unknown" as "free".
              cost:
                item.unitCostCents == null
                  ? ''
                  : String(centsToDollars(item.unitCostCents)),
            })),
            discountType:
              quote.discountType === 'PERCENT' || quote.discountType === 'AMOUNT'
                ? quote.discountType
                : null,
            discountValue: quote.discountValue,
          }}
        />
      )}

      <Card className="p-6">
        <QuoteAddons
          quoteId={quote.id}
          status={quote.status}
          currency={currency}
          addons={quote.addons.map((a) => ({
            id: a.id,
            title: a.title,
            price: centsToDollars(a.priceCents),
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
          locale={locale}
        />
      </Card>

      <SignatureRequestsCard quoteId={quote.id} L={L} locale={locale} />

      <QuoteDepositCard
        quoteId={quote.id}
        depositAmount={quote.depositAmountCents != null ? centsToDollars(quote.depositAmountCents) : null}
        deposits={quote.deposits.map((d) => ({
          id: d.id,
          amount: centsToDollars(d.amountCents),
          provider: d.provider,
          status: d.status,
          note: d.note,
          receiptUrl: d.receiptUrl,
          createdAt: d.createdAt.toISOString(),
        }))}
        locale={locale}
      />

      {/* Record-only deposits: Interac/cash/cheque collected outside EveryJob. */}
      <RecordDepositForm quoteId={quote.id} locale={locale} maxAmount={centsToDollars(quote.totalCents)} />

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

      <p className="text-[11px] text-ink-2">
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
  locale: Locale;
}) {
  const { businessId } = await requireAuth();

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
      <h3 className="text-sm font-bold text-ink">{L('esign.status')}</h3>

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
          <div key={req.id} className="border-t border-line pt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status={req.status} locale={locale} />
                <span className="text-xs text-ink-2">
                  <DateTimeText date={req.createdAt} variant="short" locale={locale === 'fr' ? 'fr' : 'en'} />
                </span>
                {req.signedAt && (
                  <span className="text-xs text-ink-2">
                    · {L('esign.statusSigned')} <DateTimeText date={req.signedAt} variant="short" locale={locale === 'fr' ? 'fr' : 'en'} />
                  </span>
                )}
                {req.signerName && (
                  <span className="text-xs font-semibold text-ink">
                    · {req.signerName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {req.status === 'signed' && (
                  <Link
                    href={`/quotes/${quoteId}/sign/${req.id}/print`}
                    className="text-xs font-bold text-info hover:text-info"
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
                <summary className="cursor-pointer font-semibold text-ink-2 hover:text-ink">
                  {L('esign.auditTitle')}
                </summary>
                <ul className="mt-1.5 space-y-1 text-ink-2">
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

      <p className="text-[11px] text-ink-2">{L('esign.legalLine')}</p>
    </Card>
  );
}
