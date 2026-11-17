import {
  Award,
  Bell,
  CalendarCheck,
  CreditCard,
  Download,
  FileText,
  ImagePlus,
  Inbox,
  Languages,
  ListChecks,
  MessageCircle,
  Palette,
  Plug,
  ShieldCheck,
  Smartphone,
  Store,
  UserCog,
  Users,
} from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, Button } from '@/components/kit';
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
import { parseFlags, isFlagOn, FLAG_NOTIFICATIONS } from '@/lib/feature-flags';
import { EXPORT_TYPES } from '@/lib/export';
import SettingsSearch from '@/components/SettingsSearch';
import SettingsTabs from '@/components/SettingsTabs';
import { SettingsSectionHeading, SettingsGroupTitle } from '@/components/SettingsSection';
import DemoSwitchCard from '@/components/DemoSwitchCard';
import ThemePicker from '@/components/ThemePicker';
import { } from '@/components/kit';
import { PageTitle } from '../_components/PageTitle';

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
 *
 * ChatGPT Settings redesign (Release 11): all 15 sections on ONE page -
 * eyebrow header, sticky pill tab nav, two-column Business group (details
 * left, logo / language / credentials right), wide single column for the
 * remaining groups, icon-tile section headings. Every section stays wired
 * to the real server actions and Prisma data; the prototype's sample data
 * is never rendered.
 */
export default async function SettingsPage() {
  const { businessId, user, role } = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      phone: true,
      whatsappNumber: true,
      workingHours: true,
      address: true,
      taxId: true,
      qstNumber: true,
      interacEmail: true,
      timezone: true,
      currency: true,
      taxRegion: true,
      gstHstRegistered: true,
      directoryOptIn: true,
      directoryHideAddress: true,
      notificationSettings: true,
      featureFlags: true,
      trade: true,
      yearsInBusiness: true,
      specialties: true,
      logoUrl: true,
      isDemo: true,
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
    <div data-settings-root className="ej-settings space-y-6">
      <PageTitle
        eyebrow={tr('t10misc.settingsMain.eyebrow')}
        title={tr('t10misc.settingsMain.title')}
        summary={tr('t10misc.settingsMain.subtitle')}
      />

      <SettingsSearch locale={locale} />

      <SettingsTabs tabs={groups.map(({ id, title }) => ({ id, label: title }))} />

      {/* ------------------------------ Business ------------------------------ */}
      <section
        id="settings-business"
        data-settings-section
        data-keywords={kw(groups[0].title, groups[0].desc, 'profile logo language trade credentials certifications business name phone address hours timezone')}
        className="scroll-mt-24 space-y-4"
      >
        <SettingsGroupTitle title={groups[0].title} desc={groups[0].desc} />
        <div className="ej-settings-business-grid">
          <div className="space-y-4">
            <SettingsForm
              business={{
                name: business.name,
                phone: business.phone ?? '',
                whatsappNumber: business.whatsappNumber ?? '',
                workingHours: business.workingHours ?? '',
                address: business.address ?? '',
                taxId: business.taxId ?? '',
                qstNumber: business.qstNumber ?? '',
                interacEmail: business.interacEmail ?? '',
                timezone: business.timezone ?? '',
                currency: 'CAD',
                taxRegion: business.taxRegion ?? '',
                gstHstRegistered: business.gstHstRegistered,
                directoryOptIn: business.directoryOptIn,
                directoryHideAddress: business.directoryHideAddress,
              }}
              heading={
                <SettingsSectionHeading
                  icon={<Store size={15} />}
                  title={tr('t10misc.settingsMain.businessDetailsTitle')}
                  desc={tr('t10misc.settingsMain.businessDetailsDesc')}
                />
              }
            />
          </div>
          <div className="space-y-4">
            <div id="logo" className="scroll-mt-24">
              <LogoUploadCard
                locale={locale}
                initialLogoUrl={business.logoUrl}
                heading={
                  <SettingsSectionHeading
                    icon={<ImagePlus size={15} />}
                    title={t(locale, 't10misc.settings.logoTitle')}
                    desc={t(locale, 't10misc.settings.logoHint')}
                  />
                }
              />
            </div>
            <Card className="p-5 md:p-6">
              <SettingsSectionHeading
                icon={<Languages size={15} />}
                title={t(locale, 'settings.language')}
                desc={t(locale, 'settings.languageHint')}
              />
              <LanguageToggle current={locale} />
            </Card>
            <Card className="p-5 md:p-6">
              <SettingsSectionHeading
                icon={<Award size={15} />}
                title={tr('credentials.cardTitle')}
                desc={tr('credentials.cardDesc')}
              />
              <DesignationsManager locale={locale} initial={designations} />
              <div className="mt-6 pt-5 border-t border-line">
                <h3 className="text-sm font-bold text-ink mb-1">{tr('credentials.tradeTitle')}</h3>
                <p className="text-xs text-ink-2 mb-4">{tr('credentials.tradeDesc')}</p>
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
          </div>
        </div>
      </section>

      {/* ------------------------------- Money -------------------------------- */}
      <section
        id="settings-money"
        data-settings-section
        data-keywords={kw(groups[1].title, groups[1].desc, 'stripe card payments tax province interac e-transfer export csv backup')}
        className="scroll-mt-24 space-y-4"
      >
        <SettingsGroupTitle title={groups[1].title} desc={groups[1].desc} />
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<CreditCard size={15} />}
            title={tr('t10misc.settingsMain.paymentsTitle')}
            desc={tr('t10misc.settingsMain.paymentsDesc')}
          />
          <Button href="/settings/payments" variant="secondary">
            {tr('t10misc.settingsMain.managePayments')}
          </Button>
        </Card>
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<Download size={15} />}
            title={tr('t10misc.settingsMain.exportTitle')}
            desc={tr('t10misc.settingsMain.exportDesc')}
          />
          <div className="flex flex-wrap gap-2">
            {EXPORT_TYPES.map((t) => (
              <a
                key={t.value}
                href={`/api/export?type=${t.value}`}
                className="bg-surface hover:bg-surface-2 text-ink px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 border border-line shadow-sm"
              >
                <Download size={13} /> {tr(`t10misc.settingsMain.${t.i18nKey}`)}
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
        <SettingsGroupTitle title={groups[2].title} desc={groups[2].desc} />
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<MessageCircle size={15} />}
            title={tr('t10misc.settingsMain.messagingTitle')}
            desc={tr('t10misc.settingsMain.messagingDesc')}
          />
          <Button href="/settings/messaging" variant="secondary">
            {tr('t10misc.settingsMain.manageMessaging')}
          </Button>
        </Card>
        <NotificationSettingsForm
          initial={parseSettings(business.notificationSettings)}
          instantOn={isFlagOn(parseFlags(business.featureFlags), FLAG_NOTIFICATIONS)}
          locale={locale}
          savedMessage={t(locale, 'notifications.settingsSaved')}
          heading={
            <SettingsSectionHeading
              icon={<Bell size={15} />}
              title={t(locale, 'notifications.settingsTitle')}
              desc={t(locale, 'notifications.settingsHint')}
            />
          }
        />
        <PushSettingsCard
          locale={locale}
          heading={
            <SettingsSectionHeading
              icon={<Smartphone size={15} />}
              title={t(locale, 'pwa.push.cardTitle')}
              desc={t(locale, 'pwa.push.cardDesc')}
            />
          }
        />
      </section>

      {/* ----------------------------- Scheduling ----------------------------- */}
      <section
        id="settings-scheduling"
        data-settings-section
        data-keywords={kw(groups[3].title, groups[3].desc, 'booking online checklists templates working hours availability')}
        className="scroll-mt-24 space-y-4"
      >
        <SettingsGroupTitle title={groups[3].title} desc={groups[3].desc} />
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<CalendarCheck size={15} />}
            title={tr('t10misc.booking.pageTitle')}
            desc={tr('t10misc.booking.pageSubtitle')}
          />
          {bookingPage?.enabled && bookingPage.slug ? (
            <div className="mb-4 p-3 bg-surface-2 rounded-lg border border-line">
              <p className="text-xs text-ink-2 mb-1">{tr('t10misc.booking.publicUrlLabel')}</p>
              <a
                href={`/book/${bookingPage.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-info hover:text-info break-all"
              >
                {`/book/${bookingPage.slug}`}
              </a>
            </div>
          ) : null}
          <Button href="/settings/booking" variant="secondary">
            {tr('t10misc.booking.pageTitle')}
          </Button>
        </Card>
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<ListChecks size={15} />}
            title={t(locale, 'jobops.templates.title')}
            desc={t(locale, 'jobops.templates.subtitle')}
          />
          <Button href="/settings/checklists" variant="secondary">
            <ListChecks size={14} /> {t(locale, 'jobops.checklist.manageTemplates')}
          </Button>
        </Card>
      </section>

      {/* -------------------------------- Team -------------------------------- */}
      <section
        id="settings-team"
        data-settings-section
        data-keywords={kw(groups[4].title, groups[4].desc, 'team members invite roles')}
        className="scroll-mt-24 space-y-4"
      >
        <SettingsGroupTitle title={groups[4].title} desc={groups[4].desc} />
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<Users size={15} />}
            title={tr('t10misc.settingsMain.manageTeam')}
            desc={groups[4].desc}
          />
          <Button href="/settings/team" variant="secondary">
            <Users size={14} /> {tr('t10misc.settingsMain.manageTeam')}
          </Button>
          <Button href="/settings/audit" variant="secondary">
            <FileText size={14} /> {tr('nav.auditLog')}
          </Button>
        </Card>
      </section>

      {/* ------------------------------- Account ------------------------------ */}
      <section
        id="settings-account"
        data-settings-section
        data-keywords={kw(groups[5].title, groups[5].desc, 'profile google security 2fa two-factor sessions password appearance dark mode theme')}
        className="scroll-mt-24 space-y-4"
      >
        <SettingsGroupTitle title={groups[5].title} desc={groups[5].desc} />
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<UserCog size={15} />}
            title={t(locale, 'googleAuth.profileTitle')}
            desc={t(locale, 'googleAuth.profileSubtitle')}
          />
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
          <SettingsSectionHeading
            icon={<Plug size={15} />}
            title={tr('t10misc.settingsMain.accountsTitle')}
            desc={tr('t10misc.settingsMain.accountsDesc')}
          />
          <Button href="/reviews" variant="secondary">
            {tr('t10misc.settingsMain.manageGoogle')}
          </Button>
        </Card>
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<ShieldCheck size={15} />}
            title={tr('t10misc.settingsMain.securityTitle')}
            desc={tr('t10misc.settingsMain.securityDesc')}
          />
          <Button href="/settings/security" variant="secondary">
            {tr('t10misc.settingsMain.manageSecurity')}
          </Button>
        </Card>
        {/* Part B: appearance (light/dark/system). */}
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<Palette size={15} />}
            title={tr('t10misc.settingsMain.appearanceTitle')}
            desc={tr('t10misc.settingsMain.appearanceDesc')}
          />
          <ThemePicker
            labels={{
              light: tr('t10misc.settingsMain.appearanceLight'),
              dark: tr('t10misc.settingsMain.appearanceDark'),
              system: tr('t10misc.settingsMain.appearanceSystem'),
            }}
          />
        </Card>
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<Plug size={15} />}
            title={t(locale, 'integrations.title')}
            desc={t(locale, 'integrations.subtitle')}
          />
          <Button href="/settings/integrations" variant="secondary">
            {t(locale, 'integrations.title')}
          </Button>
        </Card>
      </section>

      {/* ------------------------------- Support ------------------------------ */}
      <section
        id="settings-support"
        data-settings-section
        data-keywords={kw(groups[6].title, groups[6].desc, 'help support tickets inbox contact')}
        className="scroll-mt-24 space-y-4"
      >
        <SettingsGroupTitle title={groups[6].title} desc={groups[6].desc} />
        <Card className="p-5 md:p-6">
          <SettingsSectionHeading
            icon={<Inbox size={15} />}
            title={t(locale, 'support.inboxTitle')}
            desc={t(locale, 'support.inboxSub')}
          />
          <Button href="/settings/support" variant="secondary">
            {t(locale, 'support.inboxTitle')}
          </Button>
        </Card>
      </section>

      {/* Part 0: owner-only demo business switch (UAT demos, design reviews). */}
      {role === 'OWNER' && (
        <div
          data-settings-section
          data-keywords={kw(t(locale, 'demo.settingsTitle'), t(locale, 'demo.settingsDesc'), 'demo sample data uat review')}
          className="scroll-mt-24"
        >
          <DemoSwitchCard
            isDemo={!!business?.isDemo}
            title={t(locale, 'demo.settingsTitle')}
            description={t(locale, 'demo.settingsDesc')}
            viewingLabel={t(locale, 'demo.viewingDemo')}
            openLabel={t(locale, 'demo.openDemo')}
            backLabel={t(locale, 'demo.backToBusiness')}
          />
        </div>
      )}

      {/* Phase 1: Automations is deferred. The /settings/automations route
          stays live; only this surface link is hidden. Flip
          SHOW_ADVANCED_SETTINGS_LINKS to true to restore it. */}
      {SHOW_ADVANCED_SETTINGS_LINKS && (
        <Card className="p-5 md:p-6">
          <h2 className="text-sm font-bold text-ink mb-1">{t(locale, 'track8.automationsTitle')}</h2>
          <p className="text-xs text-ink-2 mb-4">{t(locale, 'track8.automationsSubtitle')}</p>
          <Button href="/settings/automations" variant="secondary">
            {t(locale, 'track8.automationsTitle')}
          </Button>
        </Card>
      )}
    </div>
  );
}
