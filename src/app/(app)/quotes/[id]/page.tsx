import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { getTaxConfig, totalTaxRate } from '@/lib/tax';
import {
  getQuoteShareState,
  regenerateQuoteShareLink,
  revokeQuoteShareLink,
  setQuoteShareLinkExpiry,
} from '@/app/actions/quotes';
import QuoteActions from './QuoteActions';
import ShareTokenManager from '@/components/ShareTokenManager';

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
      business: { select: { regionCode: true, taxRegion: true, currency: true } },
    },
  });
  if (!quote) notFound();

  const shareState = await getQuoteShareState(quote.id);

  const currency = quote.business.currency ?? 'INR';
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
        subtitle={`Created ${formatDateShort(quote.createdAt)}`}
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
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatMoney(quote.total, currency)}</p>
        </div>

        <dl className="border-t border-zinc-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatMoney(subtotal, currency)}</dd>
          </div>
          {taxLines.map((l) => (
            <div key={l.name} className="flex justify-between text-zinc-600">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(l.amount, currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-base pt-1">
            <dt className="font-bold text-zinc-900">Total</dt>
            <dd className="font-bold text-zinc-900">{formatMoney(quote.total, currency)}</dd>
          </div>
        </dl>

        <div className="border-t border-zinc-100 pt-5">
          <QuoteActions id={quote.id} status={quote.status} />
        </div>
      </Card>

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
