import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDigestData } from "@/lib/digest";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { localeMoneyTag, hasJobTime, formatJobTime } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card, StatCard, EmptyState } from "@/components/ui";
import { AttentionRow } from "@/components/AttentionBriefing";
import { DigestSettingsForm } from "@/components/DigestSettingsForm";
import {
  Sunrise,
  CalendarDays,
  Wallet,
  TrendingUp,
  CheckCircle2,
  MapPin,
  User,
} from '@/components/icons';
import Link from "next/link";

function greetingKey(dayPart: string) {
  return dayPart === 'morning'
    ? 'digest.greetingMorning'
    : dayPart === 'afternoon'
      ? 'digest.greetingAfternoon'
      : 'digest.greetingEvening';
}

export default async function DigestPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const moneyLocale = localeMoneyTag(locale);

  let data = null;
  try {
    data = await getDigestData(businessId);
  } catch (err) {
    console.error("[digest] page failed:", err);
  }

  const setting = await prisma.digestSetting.findUnique({
    where: { businessId },
  }).catch(() => null);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  }).catch(() => null);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t(locale, "digest.title")} />
        <Card>
          <EmptyState
            icon={<Sunrise size={28} className="text-amber-500" aria-hidden />}
            title={t(locale, "digest.title")}
            description={t(locale, "digest.subtitle")}
          />
        </Card>
      </div>
    );
  }

  const dateLabel = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    timeZone: data.timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Hero - light per DESIGN.md (no dark gradient on work screens) */}
      <div className="rounded-[24px] p-6 bg-surface border border-ej-smoke">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-2xl bg-ej-lime/40 text-ej-ink flex items-center justify-center">
            <Sunrise size={20} aria-hidden />
          </span>
          <p className="text-xs font-bold text-ej-muted">
            {dateLabel}
          </p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mt-2 text-ej-ink">
          {t(locale, greetingKey(data.dayPart))}
          {data.greeting ? `, ${data.greeting}` : ''} 👋
        </h1>
        <p className="text-sm text-ej-muted mt-1">
          {data.todayJobs.length === 0
            ? t(locale, 'digest.noJobsToday')
            : t(locale, 'digest.jobCount').replace('{count}', String(data.todayJobs.length)) +
              (data.tomorrowCount > 0
                ? ' · ' + t(locale, 'digest.tomorrow').replace('{count}', String(data.tomorrowCount))
                : '')}
        </p>
      </div>

      {/* Today's schedule */}
      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1 flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden /> {t(locale, 'digest.today')}
        </h2>
        {data.todayJobs.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-2 px-1 py-2">{t(locale, 'digest.noJobsToday')}</p>
          </Card>
        ) : (
          <Card className="px-2 py-2 divide-y divide-line">
            {data.todayJobs.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-2 transition-colors min-h-[56px]"
              >
                <span className="shrink-0 w-14 text-center">
                  <span className="block text-sm font-bold text-ink tabular-nums">
                    {hasJobTime(j.time) ? formatJobTime(j.time, locale) : '-'}
                  </span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink truncate">
                    {j.title}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 truncate">
                      <User size={12} aria-hidden /> {j.customerName}
                    </span>
                    {j.technician && (
                      <span className="truncate">· {j.technician}</span>
                    )}
                    {j.crewName && (
                      <span className="truncate">· {j.crewName}</span>
                    )}
                  </span>
                  {j.address && (
                    <span className="flex items-center gap-1 text-xs text-ink-2 mt-0.5 truncate">
                      <MapPin size={12} aria-hidden /> {j.address}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                  {formatMoney(j.price, business?.currency, moneyLocale)}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* Needs action */}
      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
          {t(locale, 'digest.needsAction')}
          {data.actionsTotal > 0 ? ` · ${data.actionsTotal}` : ''}
        </h2>
        {data.actions.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={28} className="text-emerald-500" aria-hidden />}
              title={t(locale, 'digest.allClear')}
              description=""
            />
          </Card>
        ) : (
          <Card className="px-2 py-2 divide-y divide-line">
            {data.actions.map((item) => (
              <AttentionRow
                key={item.id}
                item={item}
                locale={locale}
                moneyLocale={moneyLocale}
                currency={business?.currency}
              />
            ))}
            <div className="px-4 py-2">
              <Link
                href="/attention"
                className="text-sm font-semibold text-lime-700 hover:underline"
              >
                {t(locale, 'digest.viewAll')}
              </Link>
            </div>
          </Card>
        )}
      </section>

      {/* Money */}
      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1 flex items-center gap-1.5">
          <Wallet size={14} aria-hidden /> {t(locale, 'digest.moneyTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label={t(locale, 'digest.overdue')}
            value={formatMoney(data.money.overdueTotal, business?.currency, moneyLocale)}
            sub={t(locale, 'digest.overdueCount').replace('{count}', String(data.money.overdueCount))}
            icon={<Wallet size={18} aria-hidden />}
            index={0}
          />
          <StatCard
            label={t(locale, 'digest.outstanding')}
            value={formatMoney(data.money.outstandingTotal, business?.currency, moneyLocale)}
            sub={t(locale, 'digest.paidWeek')
              .replace('{amount}', formatMoney(data.money.paidThisWeek, business?.currency, moneyLocale))}
            icon={<TrendingUp size={18} aria-hidden />}
            index={1}
          />
        </div>
      </section>

      {/* Week ahead */}
      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
          {t(locale, 'digest.weekAhead')}
        </h2>
        <Card className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-lg font-bold text-ink">
              {t(locale, 'digest.weekJobs').replace('{count}', String(data.weekJobsCount))}
            </p>
            <p className="text-sm text-ink-2">
              {t(locale, 'digest.weekRevenue').replace(
                '{amount}',
                formatMoney(data.weekScheduledRevenue, business?.currency, moneyLocale)
              )}
            </p>
          </div>
          <Link
            href="/schedule"
            className="text-sm font-semibold text-lime-700 hover:underline shrink-0"
          >
            {t(locale, 'digest.viewAll')}
          </Link>
        </Card>
      </section>

      {/* Settings */}
      <section>
        <h2 className="text-xs font-bold text-ink-2 mb-2 px-1">
          {t(locale, 'digest.settings')}
        </h2>
        <Card className="p-5">
          <p className="text-sm text-ink-2 mb-4">{t(locale, 'digest.settingsDesc')}</p>
          <DigestSettingsForm
            locale={locale}
            initial={{
              enabled: setting?.enabled ?? true,
              sendTime: setting?.sendTime ?? '07:00',
              channels: (setting?.channels ?? 'IN_APP').split(','),
            }}
          />
        </Card>
      </section>
    </div>
  );
}
