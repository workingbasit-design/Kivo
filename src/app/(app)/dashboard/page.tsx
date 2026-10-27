/**
 * Part C (dashboard rebuild): the dashboard, section by section.
 *
 * Order: header, quick actions, then the customizable sections
 * (Collected, Needs you, Key numbers, Today's visits, Where your money
 * is, Last 8 weeks), then "Customize this screen". Each section loads
 * and fails independently: a skeleton while loading, an inline retry
 * when its own fetch fails, the rest of the page untouched.
 *
 * Technicians get the "My day" view (their visits only). New businesses
 * keep the checklist-first layout.
 */
import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDueJobs } from "@/lib/recurring";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n";
import { Skeleton } from '@/components/kit';
import OnboardingChecklist from "@/components/OnboardingChecklist";
import SectionShell from "@/components/dashboard/SectionShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import QuickActions from "@/components/dashboard/QuickActions";
import CollectedSection from "@/components/dashboard/CollectedSection";
import ContinueSection from "@/components/dashboard/ContinueSection";
import NextActionSection from "@/components/dashboard/NextActionSection";
import WeekProgressSection from "@/components/dashboard/WeekProgressSection";
import NeedsYou from "@/components/dashboard/NeedsYou";
import KeyNumbers from "@/components/dashboard/KeyNumbers";
import TodaysVisits from "@/components/dashboard/TodaysVisits";
import MoneyPipeline from "@/components/dashboard/MoneyPipeline";
import Last8Weeks from "@/components/dashboard/Last8Weeks";
import CustomizePanel from "@/components/dashboard/CustomizePanel";
import { getDashboardLayout, type DashboardSectionKey } from "@/lib/dashboard-layout";
import { canSeePrices } from "@/lib/roles";

function Section({
  errorMessage,
  retryLabel,
  children,
}: {
  errorMessage: string;
  retryLabel: string;
  children: React.ReactNode;
}) {
  return (
    <SectionShell errorMessage={errorMessage} retryLabel={retryLabel}>
      <Suspense fallback={<Skeleton variant="card" />}>{children}</Suspense>
    </SectionShell>
  );
}

export default async function DashboardPage() {
  const { businessId, user, role } = await requireAuth();
  const locale: Locale = await getLocale();
  const L = (path: string) => t(locale, path);

  const genPromise = (async () => {
    try {
      await generateDueJobs(businessId);
    } catch (err) {
      console.error("[dashboard] recurring generation failed:", err);
    }
  })();
  const [business] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        currency: true,
        logoUrl: true,
        timezone: true,
        regionCode: true,
        onboardingDone: true,
        teamSize: true,
      },
    }),
    genPromise,
  ]);
  if (business && !business.onboardingDone) {
    redirect("/onboarding");
  }
  const [customerCount, quoteCount, invoiceCount, teamCount, googleConn] = await Promise.all([
    prisma.customer.count({ where: { businessId, archivedAt: null } }),
    prisma.quote.count({ where: { businessId } }),
    prisma.invoice.count({ where: { businessId } }),
    prisma.membership.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.googleConnection.findUnique({ where: { businessId }, select: { id: true } }),
  ]);
  const jobCount = await prisma.job.count({ where: { businessId, archivedAt: null } });

  const onboardingCompleted = {
    logo: !!business?.logoUrl,
    customer: customerCount > 0,
    job: jobCount > 0,
    quote: quoteCount > 0 || invoiceCount > 0,
    google: !!googleConn,
    team: teamCount > 1,
  };
  const tailoredSteps: { id: "customer" | "job" | "quote" | "team"; href: string }[] = [
    { id: "customer", href: "/customers/new" },
    { id: "job", href: "/jobs/new" },
    { id: "quote", href: "/quotes/new" },
  ];
  if (business?.teamSize && business.teamSize !== "1" && teamCount <= 1) {
    tailoredSteps.push({ id: "team", href: "/settings/team" });
  }

  const timezone = business?.timezone ?? "America/Toronto";
  const regionCode = business?.regionCode ?? null;
  // SEE_PRICES gate: technicians never see money aggregates (header line).
  const showMoney = canSeePrices(role);
  const isNewBusiness = jobCount === 0 && invoiceCount === 0 && customerCount === 0;
  const errorMessage = L("dashboard.sectionFailed");
  const retryLabel = L("dashboard.sectionRetry");

  // New business: checklist-first layout (no $0.00 walls, no blank page).
  if (isNewBusiness) {
    return (
      <div className="space-y-6">
        <DashboardHeader businessId={businessId} timezone={timezone} regionCode={regionCode} showMoney={showMoney} />
        <OnboardingChecklist
          locale={locale}
          businessId={businessId}
          completed={onboardingCompleted}
          tailoredSteps={tailoredSteps}
        />
        <Section errorMessage={errorMessage} retryLabel={retryLabel}>
          <CollectedSection businessId={businessId} timezone={timezone} regionCode={regionCode} />
        </Section>
        <p className="text-center text-sm text-ink-2 dark:text-ink-2">
          {L("dashboard.firstPaymentHere")}
        </p>
      </div>
    );
  }

  // Technician: "My day" - only their visits.
  if (role === "TECHNICIAN") {
    return (
      <div className="space-y-6">
        <DashboardHeader businessId={businessId} timezone={timezone} regionCode={regionCode} showMoney={showMoney} />
        <Section errorMessage={errorMessage} retryLabel={retryLabel}>
          <ContinueSection
            businessId={businessId}
            timezone={timezone}
            regionCode={regionCode}
            technicianUserId={user.id}
          />
        </Section>
        <Section errorMessage={errorMessage} retryLabel={retryLabel}>
          <NextActionSection
            businessId={businessId}
            timezone={timezone}
            regionCode={regionCode}
            technicianUserId={user.id}
          />
        </Section>
        <Section errorMessage={errorMessage} retryLabel={retryLabel}>
          <WeekProgressSection
            businessId={businessId}
            timezone={timezone}
            regionCode={regionCode}
            technicianUserId={user.id}
          />
        </Section>
        <Section errorMessage={errorMessage} retryLabel={retryLabel}>
          <TodaysVisits
            businessId={businessId}
            timezone={timezone}
            regionCode={regionCode}
            technicianUserId={user.id}
          />
        </Section>
      </div>
    );
  }

  const layout = await getDashboardLayout(user.id, businessId, role);
  const sections: Record<DashboardSectionKey, React.ReactNode> = {
    collected: (
      <CollectedSection businessId={businessId} timezone={timezone} regionCode={regionCode} />
    ),
    needsYou: <NeedsYou businessId={businessId} />,
    keyNumbers: <KeyNumbers businessId={businessId} timezone={timezone} regionCode={regionCode} />,
    visits: <TodaysVisits businessId={businessId} timezone={timezone} regionCode={regionCode} />,
    pipeline: <MoneyPipeline businessId={businessId} />,
    last8Weeks: <Last8Weeks businessId={businessId} timezone={timezone} regionCode={regionCode} />,
  };

  return (
    <div className="space-y-5">
      <DashboardHeader businessId={businessId} timezone={timezone} regionCode={regionCode} showMoney={showMoney} />
      <Section errorMessage={errorMessage} retryLabel={retryLabel}>
        <ContinueSection businessId={businessId} timezone={timezone} regionCode={regionCode} />
      </Section>
      <Section errorMessage={errorMessage} retryLabel={retryLabel}>
        <NextActionSection businessId={businessId} timezone={timezone} regionCode={regionCode} />
      </Section>
      <Section errorMessage={errorMessage} retryLabel={retryLabel}>
        <WeekProgressSection businessId={businessId} timezone={timezone} regionCode={regionCode} />
      </Section>
      <QuickActions />
      {layout
        .filter((s) => s.visible)
        .map((s) => (
          <Section key={s.key} errorMessage={errorMessage} retryLabel={retryLabel}>
            {sections[s.key]}
          </Section>
        ))}
      <CustomizePanel
        initial={layout}
        labels={{
          customize: L("dashboard.customize"),
          title: L("dashboard.customizeTitle"),
          done: L("dashboard.customizeDone"),
          reset: L("dashboard.customizeReset"),
          moveUp: L("dashboard.customizeMoveUp"),
          moveDown: L("dashboard.customizeMoveDown"),
          show: L("dashboard.customizeShow"),
          hide: L("dashboard.customizeHide"),
          saved: L("dashboard.customizeSaved"),
          saveFailed: L("dashboard.customizeSaveFailed"),
          sectionNames: {
            collected: L("dashboard.sectionCollected"),
            needsYou: L("dashboard.sectionNeedsYou"),
            keyNumbers: L("dashboard.sectionKeyNumbers"),
            visits: L("dashboard.sectionVisits"),
            pipeline: L("dashboard.sectionPipeline"),
            last8Weeks: L("dashboard.sectionLast8Weeks"),
          },
        }}
      />
      <OnboardingChecklist
        locale={locale}
        businessId={businessId}
        completed={onboardingCompleted}
        tailoredSteps={tailoredSteps}
      />
    </div>
  );
}
