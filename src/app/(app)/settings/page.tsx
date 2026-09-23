import Link from 'next/link';
import { Download, Languages, ListChecks, Users } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, secondaryBtnClass } from '@/components/ui';
import SettingsForm from '@/components/SettingsForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import NotificationSettingsForm from '@/components/NotificationSettingsForm';
import { parseSettings } from '@/lib/notifications';
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
      notificationSettings: true,
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
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">Automated messaging</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Reminders, follow-ups and review requests — opt-in only, quiet hours, free-quota hard stop.
        </p>
        <Link href="/settings/messaging" className={secondaryBtnClass}>
          Manage messaging
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">Online payments</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Card payments via your own Stripe account. EveryJob never holds money.
        </p>
        <Link href="/settings/payments" className={secondaryBtnClass}>
          Manage payments
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">Connected accounts</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Connect Google to import your Google reviews with one tap. / Connectez Google pour importer vos avis Google en un clic.
        </p>
        <Link href="/reviews" className={secondaryBtnClass}>
          Manage Google connection
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <ListChecks size={14} /> {t(locale, 'jobops.templates.title')}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'jobops.templates.subtitle')}</p>
        <Link href="/settings/checklists" className={secondaryBtnClass}>
          <ListChecks size={14} /> {t(locale, 'jobops.checklist.manageTemplates')}
        </Link>
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
      <NotificationSettingsForm
        initial={parseSettings(business.notificationSettings)}
        locale={locale}
        savedMessage={t(locale, 'notifications.settingsSaved')}
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
