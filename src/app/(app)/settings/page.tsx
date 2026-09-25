import Link from 'next/link';
import { Award, Download, Languages, ListChecks, Users } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, secondaryBtnClass } from '@/components/ui';
import SettingsForm from '@/components/SettingsForm';
import ProfileForm from '@/components/ProfileForm';
import DesignationsManager from '@/components/DesignationsManager';
import TradeProfileForm from '@/components/TradeProfileForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import NotificationSettingsForm from '@/components/NotificationSettingsForm';
import PushSettingsCard from '@/components/PushSettingsCard';
import { parseSettings } from '@/lib/notifications';
import { EXPORT_TYPES } from '@/lib/export';

export const metadata = { title: 'Settings | EveryJob' };

export default async function SettingsPage() {
  const { businessId, user } = await requireAuth();

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
      trade: true,
      yearsInBusiness: true,
      specialties: true,
    },
  });

  if (!business) {
    throw new Error('Business not found.');
  }

  const locale = await getLocale();
  const tr = (path: string) => t(locale, path);

  const designations = await prisma.designation.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      title: true,
      issuer: true,
      number: true,
      issuedAt: true,
      expiresAt: true,
    },
  });

  let specialtiesText = '';
  try {
    const parsed = JSON.parse(business.specialties ?? '[]');
    if (Array.isArray(parsed)) specialtiesText = parsed.filter((s) => typeof s === 'string').join(', ');
  } catch {
    specialtiesText = '';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('t10misc.settingsMain.title')}
        subtitle={tr('t10misc.settingsMain.subtitle')}
        actions={
          <Link href="/settings/team" className={secondaryBtnClass}>
            <Users size={14} /> {tr('t10misc.settingsMain.manageTeam')}
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
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{tr('t10misc.settingsMain.messagingTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {tr('t10misc.settingsMain.messagingDesc')}
        </p>
        <Link href="/settings/messaging" className={secondaryBtnClass}>
          {tr('t10misc.settingsMain.manageMessaging')}
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{tr('t10misc.settingsMain.paymentsTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {tr('t10misc.settingsMain.paymentsDesc')}
        </p>
        <Link href="/settings/payments" className={secondaryBtnClass}>
          {tr('t10misc.settingsMain.managePayments')}
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'track8.automationsTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'track8.automationsSubtitle')}</p>
        <Link href="/settings/automations" className={secondaryBtnClass}>
          {t(locale, 'track8.automationsTitle')}
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'integrations.title')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'integrations.subtitle')}</p>
        <Link href="/settings/integrations" className={secondaryBtnClass}>
          {t(locale, 'integrations.title')}
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'support.inboxTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'support.inboxSub')}</p>
        <Link href="/settings/support" className={secondaryBtnClass}>
          {t(locale, 'support.inboxTitle')}
        </Link>
      </Card>
      <PushSettingsCard locale={locale} />
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{tr('t10misc.settingsMain.accountsTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {tr('t10misc.settingsMain.accountsDesc')}
        </p>
        <Link href="/reviews" className={secondaryBtnClass}>
          {tr('t10misc.settingsMain.manageGoogle')}
        </Link>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Award size={14} /> {tr('credentials.cardTitle')}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{tr('credentials.cardDesc')}</p>
        <DesignationsManager locale={locale} initial={designations} />
        <div className="mt-6 pt-5 border-t border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-900 mb-1">{tr('credentials.tradeTitle')}</h3>
          <p className="text-xs text-zinc-500 mb-4">{tr('credentials.tradeDesc')}</p>
          <TradeProfileForm
            locale={locale}
            initial={{
              trade: business.trade ?? '',
              yearsInBusiness: business.yearsInBusiness ?? null,
              specialties: specialtiesText,
            }}
          />
        </div>
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
      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'googleAuth.profileTitle')}</h2>
        <p className="text-xs text-zinc-500 mb-4">{t(locale, 'googleAuth.profileSubtitle')}</p>
        <ProfileForm
          locale={locale}
          initial={{
            name: user.name ?? '',
            email: user.email,
            phone: user.phone ?? '',
            googleLinked: !!user.googleId,
          }}
        />
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
          <Download size={14} /> {tr('t10misc.settingsMain.exportTitle')}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          {tr('t10misc.settingsMain.exportDesc')}
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
