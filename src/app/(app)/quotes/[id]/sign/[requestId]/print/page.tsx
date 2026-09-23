import { notFound, redirect } from 'next/navigation';
import { PenLine } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, PageHeader } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatDateShort } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import PrintButton from './PrintButton';

/**
 * Owner-only print view of a signed quote — the target of the
 * "Download signed PDF" link. The owner prints/saves it as PDF via the
 * browser. Only renders when the request belongs to the owner's business
 * AND its status is 'signed'.
 */

type AuditEntry = { event: string; at: string; ip: string };

function parseAudit(auditJson: string): AuditEntry[] {
  try {
    const parsed: unknown = JSON.parse(auditJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is AuditEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as { event?: unknown }).event === 'string' &&
        typeof (e as { at?: unknown }).at === 'string'
    );
  } catch {
    return [];
  }
}

const AUDIT_LABEL: Record<string, string> = {
  sent: 'esign.statusSent',
  viewed: 'esign.statusViewed',
  signed: 'esign.statusSigned',
  declined: 'esign.statusDeclined',
  revoked: 'esign.statusRevoked',
};

export default async function SignedDocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;
  const { id, requestId } = await params;

  const request = await prisma.signatureRequest.findFirst({
    where: { id: requestId, businessId },
    include: {
      quote: { include: { customer: true } },
      business: true,
    },
  });
  if (!request || request.quoteId !== id) notFound();
  // A print view only exists for completed signatures — unsigned links
  // must never render a "signed document".
  if (request.status !== 'signed') notFound();

  const locale = await getLocale();
  const L = (path: string) => t(locale, path);
  const moneyLocale = locale === 'fr' ? 'fr' : 'en';
  const { quote, business } = request;
  const audit = parseAudit(request.auditJson);
  const drawn =
    typeof request.signatureData === 'string' &&
    request.signatureData.startsWith('data:image/');
  const typedName =
    typeof request.signatureData === 'string' &&
    request.signatureData.startsWith('typed:')
      ? request.signatureData.slice('typed:'.length)
      : null;

  return (
    <div className="min-h-screen bg-paper font-sans">
      <main className="mx-auto max-w-2xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <div className="no-print mb-4 flex items-center justify-between">
          <PageHeader title={L('esign.title')} subtitle={quote.number} />
          <PrintButton label={L('esign.downloadSigned')} />
        </div>

        {/* Signed document */}
        <Card className="p-8 print:border-0 print:shadow-none">
          <div className="mb-6 border-b border-zinc-200 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {business.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">{quote.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {quote.number}
              {quote.customer ? ` · ${quote.customer.name}` : ''}
            </p>
            <p className="mt-3 text-3xl font-bold text-zinc-900">
              {formatMoney(quote.total, 'CAD', moneyLocale)}
            </p>
          </div>

          <div className="mb-6">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <PenLine size={12} /> {L('esign.statusSigned')}
            </p>
            <div className="rounded-lg border border-zinc-200 bg-white px-6 py-5">
              {drawn ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={request.signatureData!}
                  alt={request.signerName ?? 'signature'}
                  className="h-20 w-auto"
                />
              ) : (
                <p
                  className="text-4xl text-zinc-900"
                  style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
                >
                  {typedName ?? request.signerName}
                </p>
              )}
              <p className="mt-3 text-sm font-bold text-zinc-900">{request.signerName}</p>
              <p className="text-xs text-zinc-500">
                {formatDateShort(request.signedAt, locale === 'fr' ? 'fr-CA' : 'en-CA')}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {L('esign.auditTitle')}
            </p>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {audit.map((e, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-semibold text-zinc-800">
                    {L(AUDIT_LABEL[e.event] ?? 'esign.title')}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatDateShort(e.at, locale === 'fr' ? 'fr-CA' : 'en-CA')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[11px] text-zinc-400">
              doc {request.docHash.slice(0, 12)}
            </p>
          </div>

          <p className="border-t border-zinc-200 pt-4 text-center text-[11px] leading-relaxed text-zinc-400">
            {L('esign.legalLine')}
          </p>
        </Card>
      </main>

      <style>{`@media print { .no-print { display: none; } }`}</style>
    </div>
  );
}
