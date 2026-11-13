import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/kit';
import { getTaxConfig } from '@/lib/tax';
import { quoteDisplayTax } from '@/lib/quote-totals';
import { formatMoney, centsToDollars } from '@/lib/money';
import { formatDateShort } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import SignPrepareClient from './SignPrepareClient';
import { PageTitle } from '../../../_components/PageTitle';

/** Owner-side: place signature/date/initials fields on the quote document. */
export default async function SignPreparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { businessId } = await requireAuth();
  const { id } = await params;

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { name: true, phone: true } },
      business: {
        select: { name: true, regionCode: true, taxRegion: true, gstHstRegistered: true },
      },
    },
  });
  if (!quote) notFound();

  // Same display-tax rule as the quote detail page: the stored total is
  // tax-inclusive only when the business is GST/HST registered (M2), so
  // an unregistered business shows no tax lines (2026-11-13 deep test).
  const taxConfig = getTaxConfig(
    quote.business.regionCode,
    quote.business.taxRegion
  );
  const totalDollars = centsToDollars(quote.totalCents);
  const { taxable: subtotal, taxLines } = quoteDisplayTax(
    totalDollars,
    taxConfig.taxes,
    quote.business.gstHstRegistered
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/quotes/${quote.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={14} /> {L('common.back')}
      </Link>

      <PageTitle
        title={L('esign.prepareTitle')}
        summary={L('esign.prepareHint')}
      />

      <SignPrepareClient
        quoteId={quote.id}
        quoteNumber={quote.number}
        quoteTitle={quote.title}
        customerName={quote.customer.name}
        customerPhone={quote.customer.phone}
        regionCode={quote.business.regionCode}
        strings={{
          fieldSignature: L('esign.fieldSignature'),
          fieldDate: L('esign.fieldDate'),
          fieldInitials: L('esign.fieldInitials'),
          sendLink: L('esign.sendLink'),
          phone: L('customers.phone'),
          remove: L('common.delete'),
          shareTitle: L('esign.shareTitle'),
          shareHint: L('esign.shareHint'),
          copyLink: L('esign.copyLink'),
          copied: L('esign.copied'),
          legalLine: L('esign.legalLine'),
        }}
      >
        {/* The quote as a signable document. Tap it to place the selected field. */}
        <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
          <div className="border-b border-line pb-5 mb-5">
            <p className="text-[11px] font-bold text-ink-2">
              {quote.business.name}
            </p>
            <h2 className="text-xl font-bold text-ink mt-1">
              {quote.number} · {quote.title}
            </h2>
            <p className="text-xs text-ink-2 mt-1">
              {locale === 'fr'
                ? `Préparé le ${formatDateShort(quote.createdAt)} pour ${quote.customer.name}`
                : `Prepared ${formatDateShort(quote.createdAt)} for ${quote.customer.name}`}
            </p>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-2">
              <dt>Subtotal</dt>
              <dd className="font-semibold">
                {formatMoney(subtotal, 'CAD')}
              </dd>
            </div>
            {taxLines.map((l) => (
              <div key={l.name} className="flex justify-between text-ink-2">
                <dt>
                  {l.name} {l.rate}%
                </dt>
                <dd className="font-semibold">{formatMoney(l.amount, 'CAD')}</dd>
              </div>
            ))}
            <div className="flex justify-between text-base pt-1">
              <dt className="font-bold text-ink">Total</dt>
              <dd className="font-bold text-ink">
                {formatMoney(totalDollars, 'CAD')}
              </dd>
            </div>
          </dl>
        </div>
      </SignPrepareClient>
    </div>
  );
}
