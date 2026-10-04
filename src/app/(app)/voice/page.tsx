import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import VoiceModeClient from "@/components/VoiceModeClient";
import { dayRange, todayInTimezone } from "@/lib/utils";

export default async function VoicePage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, regionCode: true },
  });

  let jobs: { id: string; title: string; status: string; customer: { name: string } }[] = [];
  try {
    const todayStr = todayInTimezone(business?.timezone, business?.regionCode);
    const { gte, lte } = dayRange(todayStr);
    jobs = await prisma.job.findMany({
      where: {
        businessId,
        date: { gte, lte },
        status: { in: ["NEW", "SCHEDULED", "IN PROGRESS"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        customer: { select: { name: true } },
      },
      orderBy: { time: "asc" },
    });
  } catch (err) {
    console.error("[voice] jobs failed:", err);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={t(locale, "voice.title")}
        subtitle={t(locale, "voice.subtitle")}
      />
      <VoiceModeClient
        locale={locale}
        jobs={jobs.map((j) => ({
          id: j.id,
          title: j.title,
          customerName: j.customer.name,
          status: j.status,
        }))}
      />
    </div>
  );
}
