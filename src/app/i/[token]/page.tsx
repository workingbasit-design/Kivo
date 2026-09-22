import { headers } from 'next/headers';
import { MapPin, MessageCircle, Phone, ReceiptText } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { isLegacyCuid, resolveShareToken } from '@/lib/share';
import { waLink } from '@/lib/whatsapp';
import { displayNotes } from '@/lib/invoice-notes';
import { Card, StatusBadge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import CopyButton from '@/components/CopyButton';
import PortalNotice from '@/components/PortalNotice';

/**
 * Public client portal for an invoice. No authentication — the share token
 * in the URL is the only capability. The page loads exactly one invoice
 * and its own business/customer, nothing else. Display only: no payment is
 * processed or marked here.
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

export default async function InvoicePortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const rl = rateLimit(`portal:invoice:${await clientIp()}`, PORTAL_LIMIT);
  if (!rl.ok) return <PortalNotice variant="rate-limited" />;

  // Old cuid-based links are retired — friendly message, no data lookup.
  if (isLegacyCuid(token)) return <PortalNotice variant="legacy" />;

  const resolved = await resolveShareToken(token, 'INVOICE');
  if (!resolved.ok) return <PortalNotice variant="expired" />;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: resolved.rec.invoiceId ?? undefined,
      businessId: resolved.rec.businessId,
    },
    select: {
      id: true,
      number: true,
      date: true,
      subtotal: true,
      taxRate: true,
      taxType: true,
      taxAmount: true,
      total: true,
      status: true,
      notes: true,
      lineItems: {
        select: { description: true, qty: true, unitPrice: true },
        orderBy: { position: 'asc' },
      },
      customer: { select: { name: true } },
      business: {
        select: {
          name: true,
          phone: true,
          whatsappNumber: true,
          address: true,
          upiId: true,
          gstin: true,
          regionCode: true,
          currency: true,
        },
      },
      payments: {
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!invoice) return <PortalNotice variant="expired" />;

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const whatsappHref = waLink(
    invoice.business.whatsappNumber || invoice.business.phone,
    `Hi ${invoice.business.name}! I have a question about invoice ${invoice.number}.`,
    invoice.business.regionCode
  );

  const notes = displayNotes(invoice.notes, invoice.lineItems.length > 0);

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans">
      <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <div className="w-11 h-11 rounded-xl bg-[#6329d4] flex items-center justify-center mx-auto mb-3">
            <ReceiptText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">{invoice.business.name}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Invoice for {invoice.customer.name}</p>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{invoice.number}</p>
              <p className="text-xs text-zinc-400 mt-1">
                Dated {invoice.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {invoice.lineItems.length > 0 && (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200">
                  <th className="py-2 pr-2 font-bold">Item</th>
                  <th className="py-2 px-1 text-right font-bold">Qty</th>
                  <th className="py-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-2.5 pr-2 text-zinc-800">{item.description}</td>
                    <td className="py-2.5 px-1 text-right text-zinc-500 whitespace-nowrap">
                      {item.qty} × {formatMoney(item.unitPrice, invoice.business.currency)}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-zinc-900 whitespace-nowrap">
                      {formatMoney(round2(item.qty * item.unitPrice), invoice.business.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <dl className="space-y-2 text-sm border-t border-zinc-100 pt-4">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-semibold text-zinc-900">{formatMoney(invoice.subtotal, invoice.business.currency)}</dd>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">
                  Tax{invoice.taxType ? ` (${invoice.taxType}${invoice.taxRate ? ` ${invoice.taxRate}%` : ''})` : ''}
                </dt>
                <dd className="font-semibold text-zinc-900">{formatMoney(invoice.taxAmount, invoice.business.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-100 pt-2">
              <dt className="font-bold text-zinc-900">Total</dt>
              <dd className="text-xl font-bold text-zinc-900 tracking-tight">{formatMoney(invoice.total, invoice.business.currency)}</dd>
            </div>
            {paid > 0 && (
              <>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Paid</dt>
                  <dd className="font-semibold text-emerald-700">{formatMoney(paid, invoice.business.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-bold text-zinc-900">Balance due</dt>
                  <dd className="font-bold text-zinc-900">{formatMoney(balance, invoice.business.currency)}</dd>
                </div>
              </>
            )}
          </dl>

          {notes && (
            <p className="text-xs text-zinc-500 mt-4 bg-zinc-50 rounded-xl px-3 py-2.5 whitespace-pre-wrap">{notes}</p>
          )}
        </Card>

        {balance > 0 && invoice.business.upiId && (
          <Card className="p-6">
            <h2 className="text-sm font-bold text-zinc-900 mb-1">Pay via UPI</h2>
            <p className="text-xs text-zinc-500 mb-3">
              Pay to the business&apos;s UPI ID from any UPI app, then share the screenshot on WhatsApp.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 truncate text-zinc-800 font-mono">
                {invoice.business.upiId}
              </code>
              <CopyButton text={invoice.business.upiId} />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Kivo never handles your money — payment happens directly between you and the business.
            </p>
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

        {(invoice.business.phone || invoice.business.address) && (
          <div className="text-center text-xs text-zinc-500 space-y-1 pb-8">
            {invoice.business.phone && (
              <p>
                <a
                  href={`tel:${invoice.business.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#6329d4]"
                >
                  <Phone size={12} /> {invoice.business.phone}
                </a>
              </p>
            )}
            {invoice.business.address && (
              <p className="flex items-center justify-center gap-1.5">
                <MapPin size={12} /> {invoice.business.address}
              </p>
            )}
            {invoice.business.gstin && <p>GSTIN: {invoice.business.gstin}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
