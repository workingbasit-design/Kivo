import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { verifyBusinessEmailToken } from '@/app/actions/messaging';

/**
 * B7.6: public email-verification landing page. Single-use 24h token;
 * success stamps MessagingConnection.emailVerifiedAt, which the messaging
 * engine requires before sending customer emails.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const locale = await getLocale();
  const { token } = await searchParams;
  const result = token
    ? await verifyBusinessEmailToken(token)
    : { ok: false as const, error: 'Missing verification token.' };
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="bg-surface rounded-3xl border border-line/70 shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-ink">
          {result.ok ? t(locale, 'security.emailVerifiedTitle') : t(locale, 'security.emailVerifiedFailedTitle')}
        </h1>
        <p className="text-sm text-ink-2 mt-2">
          {result.ok
            ? t(locale, 'security.emailVerifiedBody')
            : (result.error ?? t(locale, 'security.emailVerifiedFailedBody'))}
        </p>
        <Link
          href="/settings/messaging"
          className="inline-block mt-6 rounded-xl bg-asphalt text-hero-ink text-sm font-semibold px-5 py-2.5"
        >
          {t(locale, 'security.backToMessaging')}
        </Link>
      </div>
    </div>
  );
}
