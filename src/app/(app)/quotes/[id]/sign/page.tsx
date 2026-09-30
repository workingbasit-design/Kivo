import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card } from '@/components/ui';
import { getTaxConfig, totalTaxRate } from '@/lib/tax';
import { formatMoney } from '@/lib/money';
import { formatDateShort } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import SignPrepareClient from './SignPrepareClient';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Owner-side: place signature/date/initials fields on the quote document. */
export default async function SignPreparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;
  const { id } = await params;

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { name: true, phone: true } },
      business: {
        select: { name: true, regionCode: true, taxRegion: true },
      },
    },
  });
  if (!quote) notFound();

  // Same tax math as the quote detail page: the stored total is
  // tax-inclusive, so back out the tax lines to sum exactly to the total.
  const taxConfig = getTaxConfig(
    quote.business.regionCode,
    quote.business.taxRegion
  );
  const rate = totalTaxRate(taxConfig);
  const taxAmount = rate > 0 ? round2((quote.total * rate) / (100 + rate)) : 0;
  const subtotal = round2(quote.total - taxAmount);
  const taxLines = taxConfig.taxes.map((tx) => ({
    ...tx,
    amount:
      taxConfig.taxes.length === 1
        ? taxAmount
        : round2((subtotal * tx.rate) / 100),
  }));
  if (taxLines.length > 1) {
    const sum = round2(taxLines.reduce((s, l) => s + l.amount, 0));
    taxLines[taxLines.length - 1].amount = round2(
      taxLines[taxLines.length - 1].amount + (taxAmount - sum)
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/quotes/${quote.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> {L('common.back')}
      </Link>

      <PageHeader
        title={L('esign.prepareTitle')}
        subtitle={L('esign.prepareHint')}
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
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8">
          <div className="border-b border-zinc-100 pb-5 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {quote.business.name}
            </p>
            <h2 className="text-xl font-bold text-zinc-900 mt-1">
              {quote.number} · {quote.title}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {locale === 'fr'
                ? `Préparé le ${formatDateShort(quote.createdAt)} pour ${quote.customer.name}`
                : `Prepared ${formatDateShort(quote.createdAt)} for ${quote.customer.name}`}
            </p>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-600">
              <dt>Subtotal</dt>
              <dd className="font-semibold">
                {formatMoney(subtotal, 'CAD')}
              </dd>
            </div>
            {taxLines.map((l) => (
              <div key={l.name} className="flex justify-between text-zinc-600">
                <dt>
                  {l.name} {l.rate}%
                </dt>
                <dd className="font-semibold">{formatMoney(l.amount, 'CAD')}</dd>
              </div>
            ))}
            <div className="flex justify-between text-base pt-1">
              <dt className="font-bold text-zinc-900">Total</dt>
              <dd className="font-bold text-zinc-900">
                {formatMoney(quote.total, 'CAD')}
              </dd>
            </div>
          </dl>
        </div>
      </SignPrepareClient>
    </div>
  );
}
