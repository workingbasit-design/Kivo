import Link from 'next/link';
import { Award, Download, Languages, ListChecks, ShieldCheck, Users } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, secondaryBtnClass } from '@/components/ui';
import { SectionHeader } from '@/components/design/lists';
import SettingsForm from '@/components/SettingsForm';
import LogoUploadCard from '@/components/LogoUploadCard';
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
import SettingsSearch from '@/components/SettingsSearch';

export const metadata = { title: 'Settings | EveryJob' };

/**
 * Phase 1: deferred settings surfaces (Automations) are hidden behind this
 * flag. The routes and code stay live - only the surface links are removed.
 * Set to true when the feature graduates back into Phase 1.
 */
const SHOW_ADVANCED_SETTINGS_LINKS = false;

/**
 * E7: settings are grouped by topic and searchable. Each section carries
 * data-keywords (title + description + aliases, in the current locale)
 * so the client-side search filters instantly with no refetch.
 */
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
      logoUrl: true,
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

  const bookingPage = await prisma.bookingPage.findUnique({
    where: { businessId },
    select: { slug: true, enabled: true },
  });

  let specialtiesText = '';
  try {
    const parsed = JSON.parse(business.specialties ?? '[]');
    if (Array.isArray(parsed)) specialtiesText = parsed.filter((s) => typeof s === 'string').join(', ');
  } catch {
    specialtiesText = '';
  }

  const groups = [
    { id: 'business', title: tr('t10misc.settingsMain.groupBusiness'), desc: tr('t10misc.settingsMain.groupBusinessDesc') },
    { id: 'money', title: tr('t10misc.settingsMain.groupMoney'), desc: tr('t10misc.settingsMain.groupMoneyDesc') },
    { id: 'communication', title: tr('t10misc.settingsMain.groupCommunication'), desc: tr('t10misc.settingsMain.groupCommunicationDesc') },
    { id: 'scheduling', title: tr('t10misc.settingsMain.groupScheduling'), desc: tr('t10misc.settingsMain.groupSchedulingDesc') },
    { id: 'team', title: tr('t10misc.settingsMain.groupTeam'), desc: tr('t10misc.settingsMain.groupTeamDesc') },
    { id: 'account', title: tr('t10misc.settingsMain.groupAccount'), desc: tr('t10misc.settingsMain.groupAccountDesc') },
    { id: 'support', title: tr('t10misc.settingsMain.groupSupport'), desc: tr('t10misc.settingsMain.groupSupportDesc') },
  ];

  const kw = (title: string, desc: string, extra = '') =>
    `${title} ${desc} ${extra}`.toLowerCase();

  return (
    <div data-settings-root className="space-y-6">
      <PageHeader
        title={tr('t10misc.settingsMain.title')}
        subtitle={tr('t10misc.settingsMain.subtitle')}
      />

      <SettingsSearch locale={locale} />

      <nav data-settings-nav aria-label={tr('t10misc.settingsMain.title')} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {groups.map((g) => (
          <a
            key={g.id}
            href={`#settings-${g.id}`}
            className="shrink-0 rounded-full border border-ej-border bg-ej-surface px-4 py-2 text-sm font-semibold text-ej-secondary hover:text-ej-ink hover:border-ej-ink/30 min-h-[44px] inline-flex items-center transition-colors"
          >
            {g.title}
          </a>
        ))}
      </nav>

      {/* ------------------------------ Business ------------------------------ */}
      <section
        id="settings-business"
        data-settings-section
        data-keywords={kw(groups[0].title, groups[0].desc, 'profile logo language trade credentials certifications business name phone address hours timezone')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[0].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[0].desc}</p>
        </div>
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
        <div id="logo" className="scroll-mt-24">
          <LogoUploadCard locale={locale} initialLogoUrl={business.logoUrl} />
        </div>
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
            <Languages size={14} /> {t(locale, 'settings.language')}
          </h2>
          <p className="text-xs text-zinc-500 mb-4">{t(locale, 'settings.languageHint')}</p>
          <LanguageToggle current={locale} />
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
      </section>

      {/* ------------------------------- Money -------------------------------- */}
      <section
        id="settings-money"
        data-settings-section
        data-keywords={kw(groups[1].title, groups[1].desc, 'stripe card payments tax province interac e-transfer export csv backup')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[1].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[1].desc}</p>
        </div>
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
      </section>

      {/* --------------------------- Communication ---------------------------- */}
      <section
        id="settings-communication"
        data-settings-section
        data-keywords={kw(groups[2].title, groups[2].desc, 'messaging reminders notifications push sms email')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[2].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[2].desc}</p>
        </div>
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">{tr('t10misc.settingsMain.messagingTitle')}</h2>
          <p className="text-xs text-zinc-500 mb-4">
            {tr('t10misc.settingsMain.messagingDesc')}
          </p>
          <Link href="/settings/messaging" className={secondaryBtnClass}>
            {tr('t10misc.settingsMain.manageMessaging')}
          </Link>
        </Card>
        <NotificationSettingsForm
          initial={parseSettings(business.notificationSettings)}
          locale={locale}
          savedMessage={t(locale, 'notifications.settingsSaved')}
        />
        <PushSettingsCard locale={locale} />
      </section>

      {/* ----------------------------- Scheduling ----------------------------- */}
      <section
        id="settings-scheduling"
        data-settings-section
        data-keywords={kw(groups[3].title, groups[3].desc, 'booking online checklists templates working hours availability')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[3].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[3].desc}</p>
        </div>
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">{tr('t10misc.booking.pageTitle')}</h2>
          <p className="text-xs text-zinc-500 mb-4">
            {tr('t10misc.booking.pageSubtitle')}
          </p>
          {bookingPage?.enabled && bookingPage.slug ? (
            <div className="mb-4 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <p className="text-xs text-zinc-500 mb-1">{tr('t10misc.booking.publicUrlLabel')}</p>
              <a
                href={`/book/${bookingPage.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 break-all"
              >
                {`/book/${bookingPage.slug}`}
              </a>
            </div>
          ) : null}
          <Link href="/settings/booking" className={secondaryBtnClass}>
            {tr('t10misc.booking.pageTitle')}
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
      </section>

      {/* -------------------------------- Team -------------------------------- */}
      <section
        id="settings-team"
        data-settings-section
        data-keywords={kw(groups[4].title, groups[4].desc, 'team members invite roles')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[4].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[4].desc}</p>
        </div>
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
            <Users size={14} /> {tr('t10misc.settingsMain.manageTeam')}
          </h2>
          <p className="text-xs text-zinc-500 mb-4">{groups[4].desc}</p>
          <Link href="/settings/team" className={secondaryBtnClass}>
            <Users size={14} /> {tr('t10misc.settingsMain.manageTeam')}
          </Link>
        </Card>
      </section>

      {/* ------------------------------- Account ------------------------------ */}
      <section
        id="settings-account"
        data-settings-section
        data-keywords={kw(groups[5].title, groups[5].desc, 'profile google security 2fa two-factor sessions password')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[5].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[5].desc}</p>
        </div>
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
            <ShieldCheck size={14} /> {tr('t10misc.settingsMain.securityTitle')}
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            {tr('t10misc.settingsMain.securityDesc')}
          </p>
          <Link href="/settings/security" className={secondaryBtnClass}>
            {tr('t10misc.settingsMain.manageSecurity')}
          </Link>
        </Card>
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'integrations.title')}</h2>
          <p className="text-xs text-zinc-500 mb-4">{t(locale, 'integrations.subtitle')}</p>
          <Link href="/settings/integrations" className={secondaryBtnClass}>
            {t(locale, 'integrations.title')}
          </Link>
        </Card>
      </section>

      {/* ------------------------------- Support ------------------------------ */}
      <section
        id="settings-support"
        data-settings-section
        data-keywords={kw(groups[6].title, groups[6].desc, 'help support tickets inbox contact')}
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <SectionHeader title={groups[6].title} />
          <p className="text-sm text-ej-secondary -mt-2 mb-1">{groups[6].desc}</p>
        </div>
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'support.inboxTitle')}</h2>
          <p className="text-xs text-zinc-500 mb-4">{t(locale, 'support.inboxSub')}</p>
          <Link href="/settings/support" className={secondaryBtnClass}>
            {t(locale, 'support.inboxTitle')}
          </Link>
        </Card>
      </section>

      {/* Phase 1: Automations is deferred. The /settings/automations route
          stays live; only this surface link is hidden. Flip
          SHOW_ADVANCED_SETTINGS_LINKS to true to restore it. */}
      {SHOW_ADVANCED_SETTINGS_LINKS && (
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">{t(locale, 'track8.automationsTitle')}</h2>
          <p className="text-xs text-zinc-500 mb-4">{t(locale, 'track8.automationsSubtitle')}</p>
          <Link href="/settings/automations" className={secondaryBtnClass}>
            {t(locale, 'track8.automationsTitle')}
          </Link>
        </Card>
      )}
    </div>
  );
}
