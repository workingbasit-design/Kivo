import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Printer, User, AlertTriangle } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { canSeePrices } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { localeMoneyTag } from '@/lib/utils';
import { formatMoney, centsToDollars } from '@/lib/money';
import { sumMoneyPayments } from '@/lib/invoice-status';
import MoneyText from '@/components/MoneyText';
import DateTimeText from '@/components/DateTimeText';
import { splitStoredTax, taxIdLabelForRegion } from '@/lib/tax';
import { displayNotes } from '@/lib/invoice-notes';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import {
  getInvoiceShareState,
  regenerateInvoiceShareLink,
  revokeInvoiceShareLink,
  setInvoiceShareLinkExpiry,
} from '@/app/actions/invoices';
import InvoiceActions from './InvoiceActions';
import InvoicePayButton from '@/components/InvoicePayButton';
import ShareTokenManager from '@/components/ShareTokenManager';
import PrintButton from './PrintButton';
import ReminderDraft from '@/components/ReminderDraft';
import WhatsAppButton from '@/components/WhatsAppButton';
import SmsButton from '@/components/SmsButton';
import { Chip } from '@/components/kit';
import { StatusPill } from '../../_components/status-ui';
import { PageTitle } from '../../_components/PageTitle';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 30-day payment-terms threshold, evaluated fresh per request. A plain module
 * helper (not a component) so the impure Date.now() stays out of render.
 */
function overdueThresholdMs(): number {
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId, role } = await requireAuth();

  // SEE_PRICES gate: line items, payments and balances are money data.
  // Viewers without the capability (technicians) are bounced to their
  // dashboard before the invoice is loaded.
  if (!canSeePrices(role)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      payments: { orderBy: { createdAt: 'desc' } },
      business: {
        include: {
          stripeConnection: {
            select: { chargesEnabled: true, livemode: true, liveConfirmedAt: true },
          },
        },
      },
      lineItems: { orderBy: { position: 'asc' } },
    },
  });
  if (!invoice) notFound();

  const shareState = await getInvoiceShareState(invoice.id);

  // VOID payments keep their audit row (rendered below with a VOID badge)
  // but never count toward paid / balance due (2026-10-21).
  const paidCents = sumMoneyPayments(invoice.payments);
  const paid = centsToDollars(paidCents);
  const remainingCents = invoice.totalCents - paidCents;
  const remaining = centsToDollars(remainingCents);
  // Usual 30-day payment terms - the Invoice model stores no contractual
  // due date, so this is a follow-up hint, not a legal state.
  const overdue =
    remaining > 0 &&
    invoice.status !== 'PAID' &&
    new Date(invoice.date).getTime() < overdueThresholdMs();
  const userNotes = displayNotes(invoice.notes, invoice.lineItems.length > 0);
  const currency = 'CAD';
  // Online card collection: mirror the customer portal logic - charges must
  // be enabled, and live accounts need the owner's explicit live confirmation
  // (the /api/stripe/invoice-checkout endpoint enforces this server-side too).
  const stripeConn = invoice.business.stripeConnection;
  const stripeConnected =
    stripeConn?.chargesEnabled === true && (stripeConn?.livemode !== true || !!stripeConn?.liveConfirmedAt);
  // French (fr) locale renders invoice labels in French and formats CAD
  // amounts in fr-CA style (e.g. "1 234,56 $").
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);
  const L = (path: string) => t(locale, path);

  // Per-line tax breakdown from the stored tax type + rate. Lines are
  // rounded individually and the last line absorbs any rounding difference
  // so they always sum exactly to the stored tax amount.
  const subtotalDollars = centsToDollars(invoice.subtotalCents);
  const taxAmountDollars = centsToDollars(invoice.taxAmountCents);
  const taxLines = splitStoredTax(invoice.taxType ?? '', invoice.taxRate).map((l) => ({
    ...l,
    amount: round2((subtotalDollars * l.rate) / 100),
  }));
  const linesSum = round2(taxLines.reduce((s, l) => s + l.amount, 0));
  if (taxLines.length > 0) {
    taxLines[taxLines.length - 1].amount = round2(
      taxLines[taxLines.length - 1].amount + (taxAmountDollars - linesSum)
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          href="/invoices"
          className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} /> {L('invoices.backToInvoices')}
        </Link>
        <div className="flex items-center gap-2 print:hidden">
          {/* wa.me chat with the customer - user taps to send from their own
              WhatsApp; EveryJob never sends anything automatically. */}
          <WhatsAppButton
            phone={invoice.customer.phone}
            regionCode={invoice.business.regionCode}
            message={`Hi ${invoice.customer.name}! Here is invoice ${invoice.number} from ${invoice.business.name} (${formatMoney(centsToDollars(invoice.totalCents), currency, moneyLocale)}).`}
            label="WhatsApp"
          />
          <SmsButton
            phone={invoice.customer.phone}
            regionCode={invoice.business.regionCode}
            message={`Hi ${invoice.customer.name}! Here is invoice ${invoice.number} from ${invoice.business.name} (${formatMoney(centsToDollars(invoice.totalCents), currency, moneyLocale)}).`}
            label="SMS"
          />
          <PrintButton />
        </div>
      </div>

      <PageTitle
        title={`${L('invoices.invoice')} ${invoice.number}`}
        summary={<>{L('invoices.dated')} <DateTimeText date={invoice.date} variant="short" timezone={invoice.business.timezone ?? 'America/Toronto'} locale={locale} />{invoice.dueAt && <> · {L('invoices.due')} <DateTimeText date={invoice.dueAt} variant="short" timezone={invoice.business.timezone ?? 'America/Toronto'} locale={locale} /></>}</>}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {overdue && <Chip tone="warn">{t(locale, 't10money.overdue')}</Chip>}
        <StatusPill status={invoice.status} locale={locale} />
      </div>

      {overdue && (
        <div className="bg-danger-bg border border-line rounded-2xl px-4 py-3 flex items-start gap-3 print:hidden">
          <span className="mt-0.5 text-danger shrink-0" aria-hidden><AlertTriangle size={18} /></span>
          <div>
            <p className="text-sm font-bold text-danger">
              {t(locale, 't10money.overdue')} - <MoneyText dollars={remaining} locale={locale} /> {L('invoices.balanceDue').toLowerCase()}
            </p>
            <p className="text-xs text-danger mt-0.5">{t(locale, 't10money.overdueNote')}</p>
          </div>
        </div>
      )}

      {/* Printable invoice */}
      <Card className="p-6 md:p-8 print:shadow-none print:border-line-strong" >
        <div className="flex flex-col md:flex-row justify-between gap-4 pb-6 border-b border-line">
          <div>
            <p className="text-lg font-bold text-ink">{invoice.business.name}</p>
            {invoice.business.address && (
              <p className="text-xs text-ink-2 mt-1 max-w-xs">{invoice.business.address}</p>
            )}
            {invoice.business.phone && (
              <p className="text-xs text-ink-2">{invoice.business.phone}</p>
            )}
            {invoice.business.taxId && (
              <p className="text-xs text-ink-2">{taxIdLabelForRegion(invoice.business.regionCode, locale)}: {invoice.business.taxId}</p>
            )}
            {invoice.business.qstNumber && (
              <p className="text-xs text-ink-2">QST: {invoice.business.qstNumber}</p>
            )}
          </div>
          <div className="md:text-right">
            <p className="text-xs font-bold text-ink-2">{L('invoices.billTo')}</p>
            <p className="text-sm font-bold text-ink mt-1 flex items-center gap-1.5 md:justify-end">
              <User size={14} className="text-ink-2" /> {invoice.customer.name}
            </p>
            {invoice.customer.phone && (
              <p className="text-xs text-ink-2">{invoice.customer.phone}</p>
            )}
            {invoice.customer.address && (
              <p className="text-xs text-ink-2 max-w-xs md:ml-auto">{invoice.customer.address}</p>
            )}
          </div>
        </div>

        {invoice.lineItems.length > 0 && (
          <div className="mt-6">
            <ul className="space-y-2">
              {invoice.lineItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5 print:bg-transparent"
                >
                  <p className="text-sm font-semibold text-ink">{item.description}</p>
                  <p className="text-xs text-ink-2 mt-1 tabular-nums">
                    {item.qty} × <MoneyText dollars={centsToDollars(item.unitPriceCents)} locale={locale} />
                    <span className="font-bold text-ink">
                      {' '}· <MoneyText dollars={round2(item.qty * centsToDollars(item.unitPriceCents))} locale={locale} />
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="mt-6 space-y-1.5 text-sm max-w-xs ml-auto tabular-nums">
          <div className="flex justify-between text-ink-2">
            <dt>{L('invoices.subtotal')}</dt>
            <dd className="font-semibold"><MoneyText dollars={centsToDollars(invoice.subtotalCents)} locale={locale} /></dd>
          </div>
          {taxLines.map((l) => (
            <div key={l.name} className="flex justify-between text-ink-2">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold"><MoneyText dollars={l.amount} locale={locale} /></dd>
            </div>
          ))}
          <div className="flex justify-between text-base border-t border-line pt-2 mt-2">
            <dt className="font-bold text-ink">{L('invoices.total')}</dt>
            <dd className="font-bold text-ink"><MoneyText dollars={centsToDollars(invoice.totalCents)} locale={locale} /></dd>
          </div>
          <div className="flex justify-between text-ok">
            <dt>{L('invoices.paid')}</dt>
            <dd className="font-semibold"><MoneyText dollars={paid} locale={locale} /></dd>
          </div>
          <div className="flex justify-between items-center text-base bg-asphalt text-hero-ink rounded-xl px-4 py-3 -mx-1 mt-2">
            <dt className="font-bold">{L('invoices.balanceDue')}</dt>
            <dd className="font-bold"><MoneyText dollars={remaining} locale={locale} /></dd>
          </div>
        </dl>

        {invoice.business.interacEmail && remaining > 0 && (
          <div className="mt-6 bg-surface-2 border border-line rounded-xl px-4 py-3">
            <p className="text-xs text-ink-2">
              {L('invoices.payViaInterac')} <span className="font-bold text-ink">{invoice.business.interacEmail}</span>
            </p>
            <p className="text-xs text-ink-2 mt-1">
              {L('invoices.interacReference')}: <span className="font-bold text-ink font-mono">{invoice.number}</span>
            </p>
            <p className="text-[11px] text-ink-2 mt-0.5">
              {L('invoices.interacDisclaimer')}
            </p>
          </div>
        )}

        {userNotes && (
          <div className="mt-6">
            <p className="text-[11px] font-bold text-ink-2 mb-1">{L('invoices.notes')}</p>
            <p className="text-sm text-ink-2 whitespace-pre-wrap">{userNotes}</p>
          </div>
        )}
      </Card>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-bold text-ink mb-3">{L('invoices.payments')}</h2>
          <ul className="divide-y divide-line">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-semibold text-ink tabular-nums"><MoneyText dollars={centsToDollars(p.amountCents)} locale={locale} /></p>
                  <p className="text-xs text-ink-2">
                    {p.provider}
                    {p.transactionId ? ` · Ref ${p.transactionId}` : ''} ·{' '}
                    <DateTimeText date={p.createdAt} variant="short" timezone={invoice.business.timezone ?? 'America/Toronto'} locale={locale} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={p.status} locale={locale} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6 print:hidden">
        <InvoiceActions
          id={invoice.id}
          status={invoice.status}
          remaining={remaining}
          currency={currency}
          locale={locale}
          payments={invoice.payments.map((p) => ({
            id: p.id,
            status: p.status,
            amountCents: p.amountCents,
          }))}
        />
      </Card>

      <Card className="p-6 print:hidden">
        <ShareTokenManager
          kind="invoice"
          docId={invoice.id}
          initial={shareState}
          regenerateAction={regenerateInvoiceShareLink}
          revokeAction={revokeInvoiceShareLink}
          setExpiryAction={setInvoiceShareLinkExpiry}
        />
      </Card>

      {remaining > 0 && (
        <Card className="p-6 print:hidden">
          <InvoicePayButton
            invoiceId={invoice.id}
            balance={remaining}
            currency={currency}
            stripeConnected={stripeConnected}
            locale={locale}
          />
        </Card>
      )}

      {remaining > 0 && (
        <Card className="p-6 print:hidden">
          <h2 className="text-sm font-bold text-ink mb-3">Payment reminder</h2>
          <ReminderDraft
            invoiceId={invoice.id}
            phone={invoice.customer.phone}
            regionCode={invoice.business.regionCode}
          />
        </Card>
      )}

      <div className="flex items-center gap-2 text-ink-2 print:hidden">
        <Printer size={14} />
        <p className="text-[11px]">
          {L('t10money.printHint')}
        </p>
      </div>
    </div>
  );
}
