import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Printer, User } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, StatusBadge } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { splitStoredTax } from '@/lib/tax';
import { displayNotes } from '@/lib/invoice-notes';
import {
  getInvoiceShareState,
  regenerateInvoiceShareLink,
  revokeInvoiceShareLink,
  setInvoiceShareLinkExpiry,
} from '@/app/actions/invoices';
import InvoiceActions from './InvoiceActions';
import ShareTokenManager from '@/components/ShareTokenManager';
import PrintButton from './PrintButton';
import ReminderDraft from '@/components/ReminderDraft';
import WhatsAppButton from '@/components/WhatsAppButton';

const round2 = (n: number) => Math.round(n * 100) / 100;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      payments: { orderBy: { createdAt: 'desc' } },
      business: true,
      lineItems: { orderBy: { position: 'asc' } },
    },
  });
  if (!invoice) notFound();

  const shareState = await getInvoiceShareState(invoice.id);

  const paid = Math.round(invoice.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const remaining = Math.round((invoice.total - paid) * 100) / 100;
  const userNotes = displayNotes(invoice.notes, invoice.lineItems.length > 0);
  const currency = invoice.business.currency ?? 'INR';

  // Per-line tax breakdown from the stored tax type + rate. Lines are
  // rounded individually and the last line absorbs any rounding difference
  // so they always sum exactly to the stored tax amount.
  const taxLines = splitStoredTax(invoice.taxType ?? '', invoice.taxRate).map((l) => ({
    ...l,
    amount: round2((invoice.subtotal * l.rate) / 100),
  }));
  const linesSum = round2(taxLines.reduce((s, l) => s + l.amount, 0));
  if (taxLines.length > 0) {
    taxLines[taxLines.length - 1].amount = round2(
      taxLines[taxLines.length - 1].amount + (invoice.taxAmount - linesSum)
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Back to invoices
        </Link>
        <div className="flex items-center gap-2 print:hidden">
          {/* wa.me chat with the customer — user taps to send from their own
              WhatsApp; Kivo never sends anything automatically. */}
          <WhatsAppButton
            phone={invoice.customer.phone}
            regionCode={invoice.business.regionCode}
            message={`Namaste ${invoice.customer.name}! ${invoice.business.name} se invoice ${invoice.number} (${formatMoney(invoice.total, currency)}) bheja gaya hai.`}
            label="WhatsApp"
          />
          <PrintButton />
        </div>
      </div>

      <PageHeader
        title={`Invoice ${invoice.number}`}
        subtitle={`Dated ${formatDateShort(invoice.date)}`}
        actions={<StatusBadge status={invoice.status} />}
      />

      {/* Printable invoice */}
      <Card className="p-6 md:p-8 print:shadow-none print:border-zinc-300" >
        <div className="flex flex-col md:flex-row justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <p className="text-lg font-bold text-zinc-900">{invoice.business.name}</p>
            {invoice.business.address && (
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">{invoice.business.address}</p>
            )}
            {invoice.business.phone && (
              <p className="text-xs text-zinc-500">{invoice.business.phone}</p>
            )}
            {invoice.business.gstin && (
              <p className="text-xs text-zinc-500">GSTIN: {invoice.business.gstin}</p>
            )}
          </div>
          <div className="md:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Bill to</p>
            <p className="text-sm font-bold text-zinc-900 mt-1 flex items-center gap-1.5 md:justify-end">
              <User size={14} className="text-zinc-400" /> {invoice.customer.name}
            </p>
            {invoice.customer.phone && (
              <p className="text-xs text-zinc-500">{invoice.customer.phone}</p>
            )}
            {invoice.customer.address && (
              <p className="text-xs text-zinc-500 max-w-xs md:ml-auto">{invoice.customer.address}</p>
            )}
          </div>
        </div>

        {invoice.lineItems.length > 0 && (
          <table className="w-full text-sm mt-6">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200">
                <th className="py-2 pr-2 font-bold">Item</th>
                <th className="py-2 px-2 text-right font-bold">Qty</th>
                <th className="py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100">
                  <td className="py-2.5 pr-2 text-zinc-800">{item.description}</td>
                  <td className="py-2.5 px-2 text-right text-zinc-500 whitespace-nowrap">
                    {item.qty} × {formatMoney(item.unitPrice, currency)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-zinc-900 whitespace-nowrap">
                    {formatMoney(round2(item.qty * item.unitPrice), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <dl className="mt-6 space-y-1.5 text-sm max-w-xs ml-auto">
          <div className="flex justify-between text-zinc-600">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatMoney(invoice.subtotal, currency)}</dd>
          </div>
          {taxLines.map((l) => (
            <div key={l.name} className="flex justify-between text-zinc-600">
              <dt>
                {l.name} {l.rate}%
              </dt>
              <dd className="font-semibold">{formatMoney(l.amount, currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-base border-t border-zinc-200 pt-2 mt-2">
            <dt className="font-bold text-zinc-900">Total</dt>
            <dd className="font-bold text-zinc-900">{formatMoney(invoice.total, currency)}</dd>
          </div>
          <div className="flex justify-between text-emerald-700">
            <dt>Paid</dt>
            <dd className="font-semibold">{formatMoney(paid, currency)}</dd>
          </div>
          <div className="flex justify-between text-amber-700">
            <dt>Balance due</dt>
            <dd className="font-bold">{formatMoney(remaining, currency)}</dd>
          </div>
        </dl>

        {invoice.business.upiId && remaining > 0 && (
          <div className="mt-6 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-600">
              Pay via UPI to <span className="font-bold text-zinc-900">{invoice.business.upiId}</span>
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Pay from your own UPI app — Kivo never processes payments.
            </p>
          </div>
        )}

        {userNotes && (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Notes</p>
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">{userNotes}</p>
          </div>
        )}
      </Card>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">Payments</h2>
          <ul className="divide-y divide-zinc-100">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-semibold text-zinc-900">{formatMoney(p.amount, currency)}</p>
                  <p className="text-xs text-zinc-500">
                    {p.provider}
                    {p.transactionId ? ` · Ref ${p.transactionId}` : ''} ·{' '}
                    {formatDateShort(p.createdAt)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6 print:hidden">
        <InvoiceActions id={invoice.id} status={invoice.status} remaining={remaining} currency={currency} />
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
          <h2 className="text-sm font-bold text-zinc-900 mb-3">Payment reminder</h2>
          <ReminderDraft
            invoiceId={invoice.id}
            phone={invoice.customer.phone}
            regionCode={invoice.business.regionCode}
          />
        </Card>
      )}

      <div className="flex items-center gap-2 text-zinc-400 print:hidden">
        <Printer size={14} />
        <p className="text-[11px]">
          Use the Print button for a clean paper copy.
        </p>
      </div>
    </div>
  );
}
