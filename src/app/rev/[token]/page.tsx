import { BadgeCheck, Link2Off, Star } from 'lucide-react';
import EveryJobLogo from '@/components/EveryJobLogo';
import TokenReviewForm from '@/components/TokenReviewForm';
import { getTokenReviewContext } from '@/app/actions/review-requests';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import { formatDateShort } from '@/lib/utils';

// Public page — no auth. The 256-bit token is the entire credential; only
// public-safe fields (names, job title, date) are ever rendered.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await getTokenReviewContext(token);
  return {
    title: ctx
      ? `Review ${ctx.businessName} | EveryJob`
      : 'Review link | EveryJob',
  };
}

function InvalidState({
  locale,
  businessName,
  expired,
}: {
  locale: Locale;
  businessName: string;
  expired: boolean;
}) {
  const L = (path: string) => t(locale, path);
  return (
    <div className="bg-white rounded-[20px] border border-zinc-200/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-4">
        <Link2Off size={24} />
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">
        {expired
          ? L('t10money.reviewTokenExpiredTitle')
          : L('t10money.reviewTokenInvalidTitle')}
      </h2>
      <p className="text-sm text-zinc-500">
        {(expired
          ? L('t10money.reviewTokenExpiredBody')
          : L('t10money.reviewTokenInvalidBody')
        ).replace('{business}', businessName)}
      </p>
    </div>
  );
}

export default async function TokenReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const L = (path: string) => t(locale, path);

  // Distinguish "never valid / already used" from "expired" for better copy.
  // We only learn the business name when the token format resolves; otherwise
  // fall back to a generic label — never leak which businesses exist.
  const ctx = await getTokenReviewContext(token);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 w-fit">
            <EveryJobLogo size={44} />
          </div>
          {ctx ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {L('t10money.reviewPageFor')}
              </p>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mt-1">
                {ctx.businessName}
              </h1>
              <div
                className="flex items-center justify-center gap-1 mt-2"
                aria-hidden="true"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={16}
                    className="fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-sm font-semibold text-zinc-700 mt-3">
                {L('t10money.reviewTokenTitle')}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {L('t10money.reviewTokenJobLine')
                  .replace('{job}', ctx.jobTitle)
                  .replace(
                    '{date}',
                    formatDateShort(
                      ctx.jobDate,
                      locale === 'fr' ? 'fr-CA' : 'en-CA'
                    )
                  )}
              </p>
              <p className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                <BadgeCheck size={12} />
                {L('t10money.reviewVerifiedBadge')}
              </p>
            </>
          ) : null}
        </div>

        {ctx ? (
          <TokenReviewForm
            token={token}
            customerName={ctx.customerName}
            locale={locale}
          />
        ) : (
          <InvalidState
            locale={locale}
            businessName="your pro"
            expired={false}
          />
        )}

        <p className="text-center text-[11px] text-zinc-400">
          {L('t10money.reviewPagePowered')}
        </p>
      </div>
    </div>
  );
}
