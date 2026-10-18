'use client';

import { useRef, useState, useTransition, type ElementType } from 'react';
import { CalendarDays, Upload, CheckCircle2, AlertTriangle, Download } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, kitButtonClass } from '@/components/kit';
import {
  fetchCalendarDrafts,
  confirmCalendarImport,
  listImportCustomers,
  validateCsvImport,
  commitCsvImport,
  type CalendarImportItem,
} from '@/app/actions/imports';
import type { getGoogleStatus } from '@/app/actions/google-reviews';
import type { CalendarDraft } from '@/lib/google-calendar';
import type { CsvType, CsvRecord } from '@/lib/csv';

type GoogleStatus = Awaited<ReturnType<typeof getGoogleStatus>>;
type Customer = { id: string; name: string };

function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function fmtWhen(iso: string, locale: Locale): string {
  const d = new Date(iso);
  try {
    return d.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return d.toISOString();
  }
}

function SectionTitle({ icon: Icon, title, desc }: { icon: ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-xl bg-hivis-soft text-ink">
        <Icon size={20} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="text-sm text-ink-2 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function ImportsClient({
  locale,
  googleStatus,
  initialType = 'customers',
}: {
  locale: Locale;
  googleStatus: GoogleStatus;
  /** Preselect the import type (e.g. when linked from the Customers page). */
  initialType?: CsvType;
}) {
  /* ---------------- Google Calendar ---------------- */
  const [from, setFrom] = useState(isoDay(0));
  const [to, setTo] = useState(isoDay(30));
  const [drafts, setDrafts] = useState<CalendarDraft[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pickedCustomer, setPickedCustomer] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calMsg, setCalMsg] = useState<string | null>(null);
  const [calErr, setCalErr] = useState<string | null>(null);
  const [calBusy, startCal] = useTransition();

  async function loadEvents() {
    setCalErr(null);
    setCalMsg(null);
    startCal(async () => {
      const [c, res] = await Promise.all([
        customers.length ? Promise.resolve({ ok: true as const, customers }) : listImportCustomers(),
        fetchCalendarDrafts(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`),
      ]);
      if (c.ok && c.customers) setCustomers(c.customers);
      if (!res.ok || !res.drafts) {
        setCalErr(res.error ?? t(locale, 'imports.loadFailed'));
        setDrafts([]);
        return;
      }
      setDrafts(res.drafts);
      setChecked(Object.fromEntries(res.drafts.map((d) => [d.googleEventId, true])));
      if (res.drafts.length === 0) setCalMsg(t(locale, 'imports.noEvents'));
    });
  }

  async function importSelected() {
    setCalErr(null);
    setCalMsg(null);
    const items: CalendarImportItem[] = drafts
      .filter((d) => checked[d.googleEventId] && pickedCustomer[d.googleEventId])
      .map((d) => ({
        googleEventId: d.googleEventId,
        title: d.title,
        startISO: d.startISO,
        endISO: d.endISO,
        description: d.description,
        location: d.location,
        customerId: pickedCustomer[d.googleEventId],
      }));
    startCal(async () => {
      const res = await confirmCalendarImport(items);
      if (!res.ok) {
        const err = res.error ?? t(locale, 'imports.importFailed');
        setCalErr(err);
        toast.error(err);
        return;
      }
      const parts: string[] = [];
      if ((res.imported ?? 0) > 0)
        parts.push(t(locale, 'imports.importedJobs').replace('{count}', String(res.imported)));
      if ((res.skipped ?? 0) > 0)
        parts.push(t(locale, 'imports.skippedDupes').replace('{count}', String(res.skipped)));
      const done = parts.join(' ') || t(locale, 'imports.noEvents');
      setCalMsg(done);
      toast.success(done);
      setDrafts([]);
      setChecked({});
      setPickedCustomer({});
    });
  }

  const selectableCount = drafts.filter((d) => checked[d.googleEventId] && pickedCustomer[d.googleEventId]).length;

  /* ---------------- CSV import ---------------- */
  const [csvType, setCsvType] = useState<CsvType>(initialType);
  const [csvValid, setCsvValid] = useState<CsvRecord[]>([]);
  const [csvErrors, setCsvErrors] = useState<{ row: number; message: string }[]>([]);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvBusy, startCsv] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function applyValidationResult(res: {
    ok?: boolean;
    error?: string;
    valid?: CsvRecord[];
    errors?: { row: number; message: string }[];
  }) {
    if (!res.ok) {
      setCsvErrors([{ row: 0, message: res.error ?? t(locale, 'imports.failedToRead') }]);
      return;
    }
    setCsvValid(res.valid ?? []);
    setCsvErrors(res.errors ?? []);
  }

  function handleFile(file: File | undefined) {
    setCsvMsg(null);
    setCsvValid([]);
    setCsvErrors([]);
    setCsvFileName(null);
    if (!file) return;
    setCsvFileName(file.name);
    // 2026-10-15: Excel (.xlsx/.xls) import removed — the `xlsx` (SheetJS)
    // package has unpatched high-severity advisories (GHSA-4r6h-8v6p-xvw6,
    // GHSA-5pgg-2g8v-p4x9) with no fixed version. CSV opens natively in
    // Excel / Sheets / LibreOffice, so users export from Excel as CSV.
    startCsv(async () => {
      const reader = new FileReader();
      const text = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('read'));
        reader.readAsText(file);
      }).catch(() => null);
      if (text === null) {
        setCsvErrors([{ row: 0, message: t(locale, 'imports.failedToRead') }]);
        return;
      }
      const res = await validateCsvImport(csvType, text);
      applyValidationResult(res);
    });
  }

  async function importCsv() {
    setCsvMsg(null);
    startCsv(async () => {
      const res = await commitCsvImport(csvType, csvValid);
      if (!res.ok) {
        setCsvErrors(res.errors ?? []);
        toast.error(t(locale, 'imports.importFailed'));
        return;
      }
      // Summary: created + skipped (duplicates) + failed (shown above).
      const done = t(locale, 'imports.importSummary')
        .replace('{imported}', String(res.imported ?? 0))
        .replace('{skipped}', String(res.skipped ?? 0));
      setCsvMsg(done);
      toast.success(done);
      setCsvValid([]);
      setCsvErrors([]);
      setCsvFileName(null);
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  const csvCols: Record<CsvType, { key: string; label: string }[]> = {
    customers: [
      { key: 'name', label: 'name' },
      { key: 'phone', label: 'phone' },
      { key: 'email', label: 'email' },
      { key: 'address', label: 'address' },
      { key: 'notes', label: 'notes' },
    ],
    services: [
      { key: 'name', label: 'name' },
      { key: 'price', label: 'price' },
      { key: 'durationMin', label: 'durationMin' },
      { key: 'description', label: 'description' },
    ],
    jobs: [
      { key: 'title', label: 'title' },
      { key: 'customerMatch', label: 'customer' },
      { key: 'date', label: 'date' },
      { key: 'time', label: 'time' },
      { key: 'price', label: 'price' },
      { key: 'address', label: 'address' },
      { key: 'notes', label: 'notes' },
    ],
  };

  const cellValue = (r: CsvRecord, key: string): string => {
    const v = (r as Record<string, unknown>)[key];
    return v === null || v === undefined ? '' : String(v);
  };

  return (
    <div className="space-y-8">
      {/* ============ Google Calendar ============ */}
      <Card className="p-6 space-y-5">
        <SectionTitle icon={CalendarDays} title={t(locale, 'imports.calendarTitle')} desc={t(locale, 'imports.calendarDesc')} />

        {!googleStatus.connected ? (
          <div className="rounded-xl border border-warn-line bg-warn-bg p-4">
            <p className="font-semibold text-warn-text">{t(locale, 'imports.notConnected')}</p>
            <p className="text-sm text-warn-text mt-1">{t(locale, 'imports.notConnectedDesc')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" href="/api/google/connect">
                {t(locale, 'imports.connectGoogle')}
              </Button>
              <Button variant="secondary" href="/reviews#google">
                {t(locale, 'nav.reviews')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="block text-ink-2 mb-1 font-medium">{t(locale, 'imports.from')}</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
              </label>
              <label className="text-sm">
                <span className="block text-ink-2 mb-1 font-medium">{t(locale, 'imports.to')}</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
              </label>
              <Button variant="primary" onClick={loadEvents} disabled={calBusy} className="disabled:opacity-60 disabled:cursor-not-allowed">
                {calBusy ? t(locale, 'imports.loading') : t(locale, 'imports.loadEvents')}
              </Button>
            </div>

            {calErr && (
              <div className="rounded-xl border border-danger/25 bg-danger-bg p-4 text-sm text-danger flex gap-2">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p>{calErr}</p>
                  <a href="/api/google/connect" className="underline font-semibold mt-1 inline-block">
                    {t(locale, 'imports.disconnectReconnect')}
                  </a>
                </div>
              </div>
            )}
            {calMsg && (
              <div className="rounded-xl border border-ok/25 bg-ok-bg p-4 text-sm text-ok flex gap-2">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p>{calMsg}</p>
              </div>
            )}

            {drafts.length > 0 && (
              <div className="space-y-3">
                {drafts.map((d) => (
                  <div key={d.googleEventId} className="rounded-xl border border-line p-4 flex flex-col md:flex-row md:items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!checked[d.googleEventId]}
                      onChange={(e) => setChecked((s) => ({ ...s, [d.googleEventId]: e.target.checked }))}
                      className="h-5 w-5 shrink-0"
                      aria-label={d.title}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate">{d.title}</p>
                      <p className="text-xs text-ink-2 mt-0.5">
                        {t(locale, 'imports.when')}: {fmtWhen(d.startISO, locale)}
                        {d.location ? ` · ${d.location}` : ''}
                      </p>
                      {d.description && (
                        <p className="text-xs text-ink-2 mt-1 line-clamp-2">{d.description}</p>
                      )}
                    </div>
                    <select
                      value={pickedCustomer[d.googleEventId] ?? ''}
                      onChange={(e) => setPickedCustomer((s) => ({ ...s, [d.googleEventId]: e.target.value }))}
                      className="input md:w-56"
                      aria-label={t(locale, 'imports.customer')}
                    >
                      <option value="">{t(locale, 'imports.selectCustomer')}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <Button variant="primary" onClick={importSelected} disabled={calBusy || selectableCount === 0} className="disabled:opacity-60 disabled:cursor-not-allowed">
                    {t(locale, 'imports.importSelected')}
                    {selectableCount > 0 ? ` (${selectableCount})` : ''}
                  </Button>
                  {selectableCount < drafts.filter((d) => checked[d.googleEventId]).length && (
                    <span className="text-xs text-warn-text">{t(locale, 'imports.eventNeedsCustomer')}</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ============ CSV import ============ */}
      <Card className="p-6 space-y-5">
        <SectionTitle icon={Upload} title={t(locale, 'imports.csvTitle')} desc={t(locale, 'imports.csvDesc')} />

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-ink-2 mb-1 font-medium">{t(locale, 'imports.typeLabel')}</span>
            <select
              value={csvType}
              onChange={(e) => {
                setCsvType(e.target.value as CsvType);
                setCsvValid([]);
                setCsvErrors([]);
                setCsvMsg(null);
              }}
              className="input"
            >
              <option value="customers">{t(locale, 'imports.typeCustomers')}</option>
              <option value="services">{t(locale, 'imports.typeServices')}</option>
              <option value="jobs">{t(locale, 'imports.typeJobs')}</option>
            </select>
          </label>
          <a href={`/api/imports/template?type=${csvType}`} download className={kitButtonClass('secondary')}>
            <span className="inline-flex items-center gap-2">
              <Download size={16} /> {t(locale, 'imports.downloadTemplate')}
            </span>
          </a>
          <label className="text-sm">
            <span className="block text-ink-2 mb-1 font-medium">{t(locale, 'imports.chooseFile')}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-line"
            />
          </label>
        </div>

        {csvFileName && <p className="text-xs text-ink-2">{csvFileName}</p>}
        {csvBusy && <p className="text-sm text-ink-2">{t(locale, 'imports.validating')}</p>}

        {csvErrors.length > 0 && (
          <div className="rounded-xl border border-danger/25 bg-danger-bg p-4">
            <p className="font-semibold text-danger text-sm">
              {t(locale, 'imports.rowsWithErrors').replace('{count}', String(csvErrors.length))}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-danger max-h-48 overflow-y-auto">
              {csvErrors.slice(0, 50).map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{t(locale, 'imports.rowLabel')} {e.row}:</span> {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {csvValid.length > 0 && (
          <div className="space-y-3">
            <p className="font-semibold text-ok text-sm">
              {t(locale, 'imports.validRows').replace('{count}', String(csvValid.length))}
            </p>
            {/* Desktop table */}
            <div className="overflow-x-auto rounded-xl border border-line hidden md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface-2">
                    {csvCols[csvType].map((c) => (
                      <th key={c.key} className="px-3 py-2 text-left font-semibold text-ink-2 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvValid.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {csvCols[csvType].map((c) => (
                        <td key={c.key} className="px-3 py-2 text-ink whitespace-nowrap max-w-64 truncate">
                          {cellValue(r, c.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2.5 md:hidden">
              {csvValid.slice(0, 20).map((r, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface p-3.5">
                  <dl className="space-y-1.5">
                    {csvCols[csvType].map((c) => {
                      const v = cellValue(r, c.key);
                      if (!v) return null;
                      return (
                        <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                          <dt className="shrink-0 font-medium text-ink-2">{c.label}</dt>
                          <dd className="min-w-0 text-right text-ink break-words">{v}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
            {csvValid.length > 20 && (
              <p className="text-xs text-ink-2">
                {t(locale, 't10misc.imports.moreRows').replace('{count}', String(csvValid.length - 20))}
              </p>
            )}
            <Button
              variant="primary"
              onClick={importCsv}
              disabled={csvBusy || csvValid.length === 0}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
              title={csvErrors.length > 0 ? t(locale, 'imports.hasErrorsSkipped') : undefined}
            >
              {t(locale, 'imports.importRecords').replace('{count}', String(csvValid.length))}
            </Button>
            {csvErrors.length > 0 && (
              <p className="text-xs text-warn-text mt-2">
                {t(locale, 'imports.errorsWillBeSkipped').replace('{count}', String(csvErrors.length))}
              </p>
            )}
          </div>
        )}

        {csvMsg && (
          <div className="rounded-xl border border-ok/25 bg-ok-bg p-4 text-sm text-ok flex gap-2">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <p>{csvMsg}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
