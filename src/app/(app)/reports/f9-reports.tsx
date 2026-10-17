import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { fetchF9Data, type F9Data } from '@/lib/reports-f9-data';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { F9ExportButton, type F9ReportKey } from './f9-export-button';
import { AGING_BUCKETS, type AgingBucket } from '@/lib/reports-f9';

const enF9 = {
  sectionTitle: 'Business reports',
  tabs: { revenue: 'Revenue', aging: 'AR aging', profit: 'Profit', tax: 'Tax', expenses: 'Expenses', leads: 'Leads' } as Record<F9ReportKey, string>,
  revenueTitle: 'Revenue',
  revenueSub: 'Invoiced vs collected by month',
  invoiced: 'Invoiced',
  collected: 'Collected',
  view: 'View',
  agingTitle: 'AR aging',
  agingSub: 'Outstanding by days past due (excludes voided)',
  bucketLabels: { current: 'Current', d1_30: '1–30 days', d31_60: '31–60 days', d61_90: '61–90 days', d90plus: '90+ days' } as Record<AgingBucket, string>,
  invoice: 'invoice',
  invoices: 'invoices',
  profitTitle: 'Job profitability',
  profitSub: 'Revenue minus job costs',
  costs: 'Costs',
  profit: 'Profit',
  margin: 'Margin',
  taxTitle: 'Sales tax collected',
  taxSub: 'By type and filing month (excludes voided)',
  expensesTitle: 'Expenses by category',
  expensesSub: 'With tax paid',
  taxPaid: 'Tax paid',
  entries: 'entries',
  entry: 'entry',
  leadsTitle: 'Lead sources',
  leadsSub: 'Conversion from lead to customer',
  converted: 'Converted',
  conversion: 'Conversion',
  overallConversion: 'Overall conversion',
  exportCsv: 'Export CSV',
  total: 'Total',
  noInvoices: 'No invoices yet.',
  noJobs: 'No jobs with revenue yet.',
  noTax: 'No tax collected yet.',
  noExpenses: 'No expenses yet.',
  noLeads: 'No leads yet.',
};

const frF9 = {
  sectionTitle: 'Rapports d’entreprise',
  tabs: { revenue: 'Revenus', aging: 'Créances', profit: 'Rentabilité', tax: 'Taxes', expenses: 'Dépenses', leads: 'Pistes' } as Record<F9ReportKey, string>,
  revenueTitle: 'Revenus',
  revenueSub: 'Facturé vs encaissé par mois',
  invoiced: 'Facturé',
  collected: 'Encaissé',
  view: 'Voir',
  agingTitle: 'Âge des créances',
  agingSub: 'Impayé par jours de retard (exclut les annulées)',
  bucketLabels: { current: 'À jour', d1_30: '1–30 jours', d31_60: '31–60 jours', d61_90: '61–90 jours', d90plus: '90+ jours' } as Record<AgingBucket, string>,
  invoice: 'facture',
  invoices: 'factures',
  profitTitle: 'Rentabilité des travaux',
  profitSub: 'Revenus moins coûts des travaux',
  costs: 'Coûts',
  profit: 'Profit',
  margin: 'Marge',
  taxTitle: 'Taxes perçues',
  taxSub: 'Par type et mois de déclaration (exclut les annulées)',
  expensesTitle: 'Dépenses par catégorie',
  expensesSub: 'Avec taxes payées',
  taxPaid: 'Taxes payées',
  entries: 'entrées',
  entry: 'entrée',
  leadsTitle: 'Sources de pistes',
  leadsSub: 'Conversion de piste à client',
  converted: 'Converties',
  conversion: 'Conversion',
  overallConversion: 'Conversion globale',
  exportCsv: 'Exporter CSV',
  total: 'Total',
  noInvoices: 'Aucune facture pour le moment.',
  noJobs: 'Aucun travail avec revenus pour le moment.',
  noTax: 'Aucune taxe perçue pour le moment.',
  noExpenses: 'Aucune dépense pour le moment.',
  noLeads: 'Aucune piste pour le moment.',
};

function SectionHead({
  id,
  title,
  sub,
  report,
  year,
  exportLabel,
}: {
  id: string;
  title: string;
  sub: string;
  report: F9ReportKey;
  year: number;
  exportLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4" id={id}>
      <div>
        <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
        <p className="text-[11px] text-zinc-400 font-medium mt-0.5">{sub}</p>
      </div>
      <F9ExportButton report={report} year={year} label={exportLabel} />
    </div>
  );
}

function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1 shrink-0"
    >
      {label} <ChevronRight size={13} />
    </Link>
  );
}

/**
 * F9: the six reports. Server component; data is tenant-scoped and
 * voided-aware (see fetchF9Data). Every figure links to its records.
 */
export async function F9Reports({
  businessId,
  year,
  locale,
  currency,
}: {
  businessId: string;
  year: number;
  locale: 'en' | 'fr';
  currency: string | null | undefined;
}) {
  const r = locale === 'fr' ? frF9 : enF9;
  const ml: 'en' | 'fr' = locale === 'fr' ? 'fr' : 'en';
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  const tz = business?.timezone ?? 'America/Toronto';
  const data: F9Data = await fetchF9Data(businessId, year, tz, ml);
  const money = (cents: number) => formatCents(cents, currency, ml);

  const maxRev = Math.max(
    1,
    ...data.revenue.map((m) => Math.max(m.invoicedCents, m.collectedCents)),
  );

  const tabs: { key: F9ReportKey; href: string }[] = (
    Object.keys(r.tabs) as F9ReportKey[]
  ).map((key) => ({ key, href: `#f9-${key}` }));

  return (
    <section aria-label={r.sectionTitle} className="space-y-4">
      {/* Tab nav */}
      <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={t.href}
            className="shrink-0 text-xs font-semibold px-3 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
          >
            {r.tabs[t.key]}
          </a>
        ))}
      </nav>

      {/* 1. Revenue */}
      <Card className="p-5">
        <SectionHead
          id="f9-revenue"
          title={`${r.revenueTitle} · ${year}`}
          sub={r.revenueSub}
          report="revenue"
          year={year}
          exportLabel={r.exportCsv}
        />
        {data.totals.invoicedCents === 0 && data.totals.collectedCents === 0 ? (
          <p className="text-sm text-zinc-500">{r.noInvoices}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="flex items-end gap-2 h-44">
                  {data.revenue.map((m) => (
                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="flex items-end gap-1 h-36 w-full justify-center">
                        <div
                          className="w-3 rounded-t bg-ink"
                          style={{ height: `${Math.max(2, (m.invoicedCents / maxRev) * 100)}%` }}
                          title={`${r.invoiced}: ${money(m.invoicedCents)}`}
                        />
                        <div
                          className="w-3 rounded-t bg-emerald-500"
                          style={{ height: `${Math.max(2, (m.collectedCents / maxRev) * 100)}%` }}
                          title={`${r.collected}: ${money(m.collectedCents)}`}
                        />
                      </div>
                      <Link
                        href="/invoices"
                        className="text-[10px] font-semibold text-zinc-500 hover:text-ink hover:underline"
                      >
                        {m.label}
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-zinc-500 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-ink" /> {r.invoiced}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> {r.collected}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-zinc-50 rounded-xl p-3">
                <p className="text-[11px] text-zinc-500 font-medium">{r.invoiced}</p>
                <p className="text-lg font-bold text-zinc-900">{money(data.totals.invoicedCents)}</p>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3">
                <p className="text-[11px] text-zinc-500 font-medium">{r.collected}</p>
                <p className="text-lg font-bold text-zinc-900">{money(data.totals.collectedCents)}</p>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* 2. AR aging */}
      <Card className="p-5">
        <SectionHead
          id="f9-aging"
          title={r.agingTitle}
          sub={r.agingSub}
          report="aging"
          year={year}
          exportLabel={r.exportCsv}
        />
        {data.aging.totalCount === 0 ? (
          <p className="text-sm text-zinc-500">{r.noInvoices}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {AGING_BUCKETS.map((b) => {
              const row = data.aging.buckets[b];
              return (
                <li key={b} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{r.bucketLabels[b]}</p>
                    <p className="text-[11px] text-zinc-500">
                      {row.count} {row.count === 1 ? r.invoice : r.invoices}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-bold text-zinc-900">{money(row.outstandingCents)}</p>
                    {row.count > 0 && <ViewLink href="/invoices?status=UNPAID" label={r.view} />}
                  </div>
                </li>
              );
            })}
            <li className="flex items-center justify-between py-3 gap-3">
              <p className="text-sm font-bold text-zinc-900">{r.total}</p>
              <p className="text-sm font-bold text-zinc-900">{money(data.aging.totalOutstandingCents)}</p>
            </li>
          </ul>
        )}
      </Card>

      {/* 3. Job profitability */}
      <Card className="p-5">
        <SectionHead
          id="f9-profit"
          title={`${r.profitTitle} · ${year}`}
          sub={r.profitSub}
          report="profit"
          year={year}
          exportLabel={r.exportCsv}
        />
        {data.profit.length === 0 ? (
          <p className="text-sm text-zinc-500">{r.noJobs}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.profit.slice(0, 25).map((j) => (
              <li key={j.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/jobs/${j.id}`}
                    className="text-sm font-semibold text-zinc-900 hover:underline truncate min-w-0"
                  >
                    {j.title}
                  </Link>
                  <p
                    className={cn(
                      'text-sm font-bold shrink-0',
                      j.profitCents < 0 ? 'text-red-600' : 'text-emerald-600',
                    )}
                  >
                    {money(j.profitCents)}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                  <span>{money(j.revenueCents)}</span>
                  <span>− {r.costs.toLowerCase()} {money(j.costCents)}</span>
                  {j.marginPct !== null && (
                    <span className="font-semibold">{r.margin}: {j.marginPct}%</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4. Sales tax */}
      <Card className="p-5">
        <SectionHead
          id="f9-tax"
          title={`${r.taxTitle} · ${year}`}
          sub={r.taxSub}
          report="tax"
          year={year}
          exportLabel={r.exportCsv}
        />
        {data.tax.types.length === 0 ? (
          <p className="text-sm text-zinc-500">{r.noTax}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-[11px] text-zinc-400 font-semibold border-b border-zinc-100">
                  <th className="py-2 pr-2 font-semibold"></th>
                  {data.tax.types.map((t) => (
                    <th key={t} className="py-2 px-2 font-semibold text-right">{t}</th>
                  ))}
                  <th className="py-2 pl-2 font-semibold text-right">{r.total}</th>
                </tr>
              </thead>
              <tbody>
                {data.tax.rows
                  .filter((row) => row.totalCents > 0)
                  .map((row) => (
                    <tr key={row.key} className="border-b border-zinc-50">
                      <td className="py-2 pr-2">
                        <Link href="/invoices" className="font-semibold text-zinc-700 hover:underline">
                          {row.label}
                        </Link>
                      </td>
                      {data.tax.types.map((t) => (
                        <td key={t} className="py-2 px-2 text-right tabular-nums text-zinc-600">
                          {money(row.byType[t] ?? 0)}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right font-bold tabular-nums text-zinc-900">
                        {money(row.totalCents)}
                      </td>
                    </tr>
                  ))}
                <tr>
                  <td className="py-2 pr-2 font-bold text-zinc-900">{r.total}</td>
                  {data.tax.types.map((t) => (
                    <td key={t} className="py-2 px-2 text-right font-bold tabular-nums text-zinc-900">
                      {money(data.tax.totals[t] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-bold tabular-nums text-zinc-900">
                    {money(Object.values(data.tax.totals).reduce((s, v) => s + v, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 5. Expenses */}
      <Card className="p-5">
        <SectionHead
          id="f9-expenses"
          title={`${r.expensesTitle} · ${year}`}
          sub={r.expensesSub}
          report="expenses"
          year={year}
          exportLabel={r.exportCsv}
        />
        {data.expenses.length === 0 ? (
          <p className="text-sm text-zinc-500">{r.noExpenses}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.expenses.map((e) => (
              <li key={e.category} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 capitalize">
                    {e.category.toLowerCase().replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {r.taxPaid}: {money(e.taxCents)} · {e.count} {e.count === 1 ? r.entry : r.entries}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-bold text-zinc-900">{money(e.amountCents)}</p>
                  <ViewLink href="/expenses" label={r.view} />
                </div>
              </li>
            ))}
            <li className="flex items-center justify-between py-3 gap-3">
              <p className="text-sm font-bold text-zinc-900">{r.total}</p>
              <p className="text-sm font-bold text-zinc-900">{money(data.totals.expenseCents)}</p>
            </li>
          </ul>
        )}
      </Card>

      {/* 6. Leads */}
      <Card className="p-5">
        <SectionHead
          id="f9-leads"
          title={r.leadsTitle}
          sub={r.leadsSub}
          report="leads"
          year={year}
          exportLabel={r.exportCsv}
        />
        {data.leads.rows.length === 0 ? (
          <p className="text-sm text-zinc-500">{r.noLeads}</p>
        ) : (
          <>
            <div className="bg-zinc-50 rounded-xl p-3 mb-4 flex items-center justify-between">
              <p className="text-[11px] text-zinc-500 font-medium">{r.overallConversion}</p>
              <p className="text-lg font-bold text-zinc-900">{data.leads.conversionPct}%</p>
            </div>
            <ul className="space-y-3">
              {data.leads.rows.map((l) => (
                <li key={l.source}>
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <Link
                      href="/leads"
                      className="text-xs font-semibold text-zinc-700 hover:underline truncate min-w-0"
                    >
                      {l.source}
                    </Link>
                    <p className="text-xs font-bold text-zinc-900 shrink-0 tabular-nums">
                      {l.converted}/{l.total} · {l.conversionPct}%
                    </p>
                  </div>
                  <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ink rounded-full"
                      style={{ width: `${Math.max(2, Math.min(100, l.conversionPct))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {l.total} · {l.converted} {r.converted.toLowerCase()}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}
