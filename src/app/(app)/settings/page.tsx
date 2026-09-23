import Link from 'next/link';
import { Download, Languages, Users } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, secondaryBtnClass } from '@/components/ui';
import SettingsForm from '@/components/SettingsForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { EXPORT_TYPES } from '@/lib/export';

export const metadata = { title: 'Settings | EveryJob' };

export default async function SettingsPage() {
  const { businessId } = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      phone: true,
      whatsappNumber: true,
      workingHours: true,
      address: true,
      taxId: true,
      interacEmail: true,
      timezone: true,
      currency: true,
      taxRegion: true,
      directoryOptIn: true,
      directoryHideAddress: true,
    },
  });

  if (!business) {
    throw new Error('Business not found.');
  }

  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your business profile, shown on quotes and invoices."
        actions={
          <Link href="/settings/team" className={secondaryBtnClass}>
            <Users size={14} /> Manage team
          </Link>
        }
      />
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Languages size={14} /> {t(locale, 'settings.language')}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'settings.languageHint')}</p>
        <LanguageToggle current={locale} />
      </Card>
      <SettingsForm
        business={{
          name: business.name,
          phone: business.phone ?? '',
          whatsappNumber: business.whatsappNumber ?? '',
          workingHours: business.workingHours ?? '',
          address: business.address ?? '',
          taxId: business.taxId ?? '',
          interacEmail: business.interacEmail ?? '',
          timezone: business.timezone ?? '',
          currency: 'CAD',
          taxRegion: business.taxRegion ?? '',
          directoryOptIn: business.directoryOptIn,
          directoryHideAddress: business.directoryHideAddress,
        }}
      />
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Download size={14} /> Data export & backup
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          Your data belongs to you. Download any list as a CSV file anytime — no lock-in, no fees.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXPORT_TYPES.map((t) => (
            <a
              key={t.value}
              href={`/api/export?type=${t.value}`}
              className="bg-white hover:bg-zinc-50 text-zinc-700 px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-zinc-200 shadow-sm"
            >
              <Download size={13} /> {t.label}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
