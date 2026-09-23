import { headers } from 'next/headers';
import { FileText, PenLine } from 'lucide-react';
import {
  resolveSignatureRequest,
  recordView,
  verifyDocHash,
  type SignField,
} from '@/lib/esign';
import { rateLimit } from '@/lib/rate-limit';
import { formatMoney } from '@/lib/money';
import { Card } from '@/components/ui';
import PortalNotice from '@/components/PortalNotice';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import SignClient from './SignClient';

/**
 * Public signing page. No authentication — the signing token in the URL
 * is the only capability, exactly like the customer portal. All data is
 * loaded strictly through the resolved token (never a quoteId from the
 * URL), so one business's quote can never leak to another token holder.
 */

const SIGN_LIMIT = { limit: 30, windowMs: 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

function parseFields(fieldsJson: string): SignField[] {
  try {
    const parsed: unknown = JSON.parse(fieldsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is SignField =>
        !!f &&
        typeof f === 'object' &&
        (f as { type?: unknown }).type !== undefined &&
        ['signature', 'date', 'initials'].includes((f as { type: string }).type) &&
        typeof (f as { x?: unknown }).x === 'number' &&
        typeof (f as { y?: unknown }).y === 'number'
    );
  } catch {
    return [];
  }
}

const FIELD_LABEL: Record<SignField['type'], string> = {
  signature: 'esign.fieldSignature',
  date: 'esign.fieldDate',
  initials: 'esign.fieldInitials',
};

function FieldMarker({
  field,
  locale,
}: {
  field: SignField;
  locale: Locale;
}) {
  // Field coords are fractions (0..1) from the owner prepare UI; tolerate
  // pixel values defensively by clamping into the container.
  const left = Math.min(100, Math.max(0, field.x <= 1 ? field.x * 100 : field.x));
  const top = Math.min(100, Math.max(0, field.y <= 1 ? field.y * 100 : field.y));
  return (
    <span
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-[#17122b]/30 bg-[#17122b]/90 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <PenLine size={10} />
      {t(locale, FIELD_LABEL[field.type])}
    </span>
  );
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  // Token is validated (hash + expiry + revocation) inside
  // resolveSignatureRequest BEFORE anything renders.
  const rl = rateLimit(`sign:${await clientIp()}`, SIGN_LIMIT);
  if (!rl.ok) return <PortalNotice variant="rate-limited" />;

  const resolved = await resolveSignatureRequest(token);
  if (!resolved) return <PortalNotice variant="expired" />;

  // Tamper evidence: the quote changed after the link went out.
  // Surface the same generic "invalid or expired" notice.
  if (!verifyDocHash(resolved)) return <PortalNotice variant="expired" />;

  // Best-effort first-view audit event; never blocks rendering.
  try {
    await recordView(resolved.id, await clientIp());
  } catch {
    /* ignore */
  }

  const { quote, business } = resolved;
  const customerName = quote.customer?.name ?? null;
  const fields = parseFields(resolved.fieldsJson);

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans">
      <header className="bg-[#17122b] text-white">
        <div className="mx-auto max-w-lg px-4 py-8">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b8b0c9]">
            {business.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{L('esign.signTitle')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-12">
        {/* The quote, rendered as a self-contained document. */}
        <Card className="relative overflow-hidden p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <FileText size={12} /> {quote.number}
              </p>
              <h2 className="mt-1 text-lg font-bold text-zinc-900">{quote.title}</h2>
              {customerName && (
                <p className="mt-1 text-sm text-zinc-500">{customerName}</p>
              )}
            </div>
            <p className="shrink-0 text-xl font-bold text-zinc-900">
              {formatMoney(quote.total, 'CAD', locale)}
            </p>
          </div>

          <div className="rounded-lg bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold text-zinc-600">{business.name}</p>
          </div>

          {/* Placed signing fields overlaid on the document. */}
          {fields.map((f, i) => (
            <FieldMarker key={`${f.type}-${i}`} field={f} locale={locale} />
          ))}
        </Card>

        <SignClient
          token={token}
          signerNameHint={customerName}
          strings={{
            signName: L('esign.signName'),
            signDrawHint: L('esign.signDrawHint'),
            signClear: L('esign.signClear'),
            signButton: L('esign.signButton'),
            signedTitle: L('esign.signedTitle'),
            legalLine: L('esign.legalLine'),
            errorGeneric: L('esign.linkInvalid'),
            retry: L('common.retry'),
            signing: L('common.saving'),
          }}
        />

        <p className="pt-2 text-center text-[11px] text-zinc-400">
          Shared privately by {business.name} · Powered by EveryJob
        </p>
      </main>
    </div>
  );
}
