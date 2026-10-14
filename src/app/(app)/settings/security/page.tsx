import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/prisma';
import TotpSetupClient from '@/components/TotpSetupClient';

export const metadata = { title: 'Security | EveryJob' };

/**
 * B7.4: security settings - TOTP two-factor enrollment. Shows the
 * `?totp=required` notice when an owner is redirected here from the Stripe
 * Connect flow without 2FA enabled.
 */
export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ totp?: string }>;
}) {
  const { user } = await requireAuth();
  const locale = await getLocale();
  const params = await searchParams;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader title={t(locale, 'security.title')} subtitle={t(locale, 'security.subtitle')} />
      <TotpSetupClient
        locale={locale}
        initiallyEnabled={row?.totpEnabled ?? false}
        requiredNotice={params?.totp === 'required'}
      />
    </div>
  );
}
