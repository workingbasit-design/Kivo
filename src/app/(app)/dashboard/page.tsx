import React from "react";
import Link from "next/link";
import {
  Calendar,
  Banknote,
  AlertCircle,
  UserPlus,
  Clock,
  ChevronRight,
  Plus,
  CalendarDays,
  Receipt,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/dashboard";
import { generateDueJobs } from "@/lib/recurring";
import { formatDateLabel } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card, StatCard, StatusBadge, EmptyState } from "@/components/ui";
import DatabaseInspectorClient from "@/components/DatabaseInspectorClient";

const QUICK_ACTIONS = [
  { label: "New job", href: "/jobs/new", icon: Plus },
  { label: "New customer", href: "/customers/new", icon: Plus },
  { label: "New quote", href: "/quotes/new", icon: Plus },
  { label: "New invoice", href: "/invoices/new", icon: Plus },
];

export default async function DashboardPage() {
  const { businessId } = await requireAuth();

  // Lazy auto-generation: create jobs for any due recurring plans before
  // rendering, so jobs appear without the user tapping "Generate due jobs".
  // Best-effort — a failure here must never break the dashboard itself.
  try {
    await generateDueJobs(businessId);
  } catch (err) {
    console.error('[dashboard] recurring generation failed:', err);
  }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = business?.currency;
  const stats = await getDashboardStats(businessId);
  const todayLabel = formatDateLabel(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={todayLabel}
        actions={
          <Link
            href="/jobs/new"
            className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <Plus size={14} /> New job
          </Link>
        }
      />

      {/* Stat cards */}
      {stats.totalCustomers === 0 && (
        <DatabaseInspectorClient
          summary={{
            jobsCount: 0,
            customersCount: 0,
            invoicesCount: 0,
            quotesCount: 0,
            servicesCount: 0,
            usersCount: 1,
            communicationsCount: 0,
            leadsCount: 0,
          }}
        />
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Booked today"
          value={formatMoney(stats.bookedToday, currency)}
          sub={`${stats.jobsLeftToday} job${stats.jobsLeftToday === 1 ? "" : "s"} still open`}
          icon={<Calendar size={16} />}
          accent="bg-violet-100 text-[#6329d4]"
        />
        <StatCard
          label="Collected · 7 days"
          value={formatMoney(stats.collectedThisWeek, currency)}
          sub="Payments received"
          icon={<Banknote size={16} />}
          accent="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Outstanding"
          value={formatMoney(stats.outstanding, currency)}
          sub={`${stats.outstandingCount} unpaid invoice${stats.outstandingCount === 1 ? "" : "s"}`}
          icon={<AlertCircle size={16} />}
          accent="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="New leads"
          value={String(stats.newLeads)}
          sub={`${stats.totalCustomers} total customers`}
          icon={<UserPlus size={16} />}
          accent="bg-blue-100 text-blue-700"
        />
      </div>

      {/* Today's schedule + payments due */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Clock size={15} className="text-[#6329d4]" /> Today&apos;s schedule
            </h2>
            <Link
              href="/schedule"
              className="text-xs font-semibold text-[#6329d4] hover:underline inline-flex items-center gap-1"
            >
              Schedule <ChevronRight size={13} />
            </Link>
          </div>
          {stats.todayJobs.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="Nothing scheduled today"
              description="Enjoy the breather — or book a job in under 20 seconds."
              action={
                <Link
                  href="/jobs/new"
                  className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2"
                >
                  <Plus size={14} /> New job
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100 px-2 pb-2">
              {stats.todayJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-xs font-bold text-zinc-900">{job.time ?? "—"}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{job.customerName}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Receipt size={15} className="text-amber-600" /> Payments due
            </h2>
            <Link
              href="/invoices"
              className="text-xs font-semibold text-[#6329d4] hover:underline inline-flex items-center gap-1"
            >
              Invoices <ChevronRight size={13} />
            </Link>
          </div>
          {stats.dueInvoices.length === 0 ? (
            <EmptyState
              icon={<Banknote size={22} />}
              title="All caught up"
              description="No unpaid invoices. Money in the bank, zero chasing."
            />
          ) : (
            <ul className="divide-y divide-zinc-100 px-2 pb-2">
              {stats.dueInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {inv.number} · {inv.customerName}
                      </p>
                      <p className="text-xs text-zinc-500">{formatDateLabel(inv.date)}</p>
                    </div>
                    <p className="text-sm font-bold text-zinc-900">{formatMoney(inv.outstanding, currency)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Upcoming + jobs by status + quick actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">Upcoming jobs</h2>
          {stats.upcomingJobs.length === 0 ? (
            <p className="text-sm text-zinc-500">No upcoming jobs scheduled.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {stats.upcomingJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{job.title}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {job.customerName}
                        {job.time ? ` · ${job.time}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-100">
            <p className="w-full text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Jobs by status
            </p>
            {stats.jobsByStatus.length === 0 ? (
              <p className="text-sm text-zinc-500">No jobs yet.</p>
            ) : (
              stats.jobsByStatus.map((g) => (
                <Link
                  key={g.status}
                  href="/jobs"
                  className="inline-flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-[#6329d4]/40 transition-colors"
                >
                  <StatusBadge status={g.status} />
                  <span>{g.count}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex flex-col items-center gap-2 bg-zinc-50 hover:bg-[#6329d4]/5 border border-zinc-200 hover:border-[#6329d4]/30 rounded-2xl p-4 transition-colors"
              >
                <span className="w-9 h-9 rounded-xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center">
                  <a.icon size={16} />
                </span>
                <span className="text-xs font-semibold text-zinc-700">{a.label}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/reports"
            className="mt-4 flex items-center justify-between bg-zinc-900 text-white rounded-2xl px-4 py-3 hover:bg-zinc-800 transition-colors"
          >
            <span className="text-xs font-semibold">View business reports</span>
            <ChevronRight size={14} />
          </Link>
        </Card>
      </div>
    </div>
  );
}
