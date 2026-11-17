'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Play, Trash2, Loader2, Save, CheckCircle2, Download, FileText } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Card,
  Input,
  Textarea,
} from '@/components/kit';
import { saveReport, deleteReport } from '@/app/actions/reports';
import type { ReportConfig, ReportResult } from '@/lib/reports';

export interface SavedReportLite {
  id: string;
  name: string;
  prompt: string;
  configJson: string;
  updatedAt: string;
}

interface BuiltReport {
  config: ReportConfig;
  result: ReportResult;
  defaulted: boolean;
}

const EXAMPLES: Record<Locale, string[]> = {
  en: [
    'Revenue by month for the last 30 days',
    'Expenses by category this year',
    'Jobs by status this month',
    'How many quotes did we send last month?',
  ],
  fr: [
    'Revenus par mois pour les 30 derniers jours',
    'Dépenses par catégorie cette année',
    'Jobs par statut ce mois-ci',
    'Combien de devis avons-nous envoyés le mois dernier ?',
  ],
};

/** "Revenue, grouped by month, last 30 days" - shows the user what was parsed. */
function describeConfig(config: ReportConfig, locale: Locale): string {
  const parts = [
    t(locale, `reports.type.${config.type}`),
    t(locale, `reports.groupBy.${config.groupBy}`),
    t(locale, `reports.range.${config.dateRange}`),
  ];
  if (config.metric !== 'total') {
    parts.push(t(locale, `reports.metric.${config.metric}`));
  }
  return parts.join(', ');
}

/** Which report types carry money values (vs plain counts). */
function isMoneyReport(config: ReportConfig): boolean {
  if (config.type === 'customers') return false;
  if (config.type === 'jobs') return config.metric !== 'count';
  return true;
}

export function ReportBuilder({
  locale,
  currency,
  savedReports,
}: {
  locale: Locale;
  currency: string | null | undefined;
  savedReports: SavedReportLite[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [built, setBuilt] = useState<BuiltReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const run = async (text: string) => {
    const clean = text.trim();
    if (!clean || running) return;
    setRunning(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: clean.slice(0, 500), locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BuiltReport;
      setBuilt(data);
      setSaveName(clean.slice(0, 60));
    } catch {
      setError(t(locale, 'reports.runError'));
      setBuilt(null);
    } finally {
      setRunning(false);
    }
  };

  const submit = () => run(prompt);

  const save = async () => {
    if (!built || saving) return;
    const name = saveName.trim();
    if (!name) {
      setSaveMsg(t(locale, 'reports.invalidReport'));
      return;
    }
    setSaving(true);
    const r = await saveReport(name, prompt.trim().slice(0, 500), built.config);
    setSaving(false);
    if (r.ok) {
      setSaveMsg(t(locale, 'reports.saved'));
      router.refresh();
    } else {
      setSaveMsg(r.error ?? t(locale, 'reports.runError'));
    }
  };

  const remove = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    const r = await deleteReport(id);
    setDeletingId(null);
    if (r.ok) router.refresh();
  };

  const moneyLocale = locale === 'fr' ? 'fr' : 'en';
  const money = built ? isMoneyReport(built.config) : false;
  const fmt = (n: number) =>
    money ? formatMoney(n, currency, moneyLocale) : String(Math.round(n));

  /** Export the built report as a plain-text file (real rows only). */
  const exportBuilt = () => {
    if (!built) return;
    const lines = [
      t(locale, `reports.type.${built.config.type}`),
      describeConfig(built.config, locale),
      '',
      `${t(locale, 'reports.total')}: ${fmt(built.result.total)}`,
      `${t(locale, 'reports.countLabel')}: ${built.result.totalCount}`,
      ...built.result.rows.map(
        (row) =>
          `${row.label}, ${fmt(row.value)}${row.count !== undefined ? ` (${row.count})` : ''}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'everyjob-report.txt';
    a.click();
    URL.revokeObjectURL(url);
    setSaveMsg(t(locale, 'reports.exported'));
  };

  return (
    <div className="space-y-6">
      {/* Builder */}
      <Card className="p-5">
        <div className="flex items-start gap-2.5 mb-4">
          <span className="w-6 h-6 grid place-items-center rounded-lg bg-ok-bg text-ok shrink-0">
            <Sparkles size={15} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">
              {t(locale, 'reports.builderTitle')}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              {t(locale, 'reports.builderSubtitle')}
            </p>
          </div>
        </div>

        <Textarea
          label={t(locale, 'reports.promptLabel')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t(locale, 'reports.promptPlaceholder')}
          rows={2}
          maxLength={500}
        />

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-ink-2 font-medium">
            {t(locale, 'reports.examples')}
          </span>
          {EXAMPLES[locale].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setPrompt(ex);
                run(ex);
              }}
              className="text-xs font-medium text-ink-2 bg-surface-2 hover:bg-line border border-line rounded-full px-3 py-2 min-h-[44px] transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="primary"
          block
          onClick={submit}
          disabled={running || !prompt.trim()}
          className="mt-4"
        >
          {running ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t(locale, 'reports.building')}
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {t(locale, 'reports.build')}
            </>
          )}
        </Button>

        {error && (
          <p className="text-sm text-danger font-medium mt-3" role="alert">
            {error}
          </p>
        )}

        {built && (
          <div className="mt-5 pt-5 border-t border-line">
            {/* Generated report (prototype `.generated-report`) */}
            <div className="p-3.5 border border-line rounded-[13px] bg-surface-2/60">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-ok text-[11px] font-extrabold uppercase tracking-[0.1em]">
                    <CheckCircle2 size={13} />
                    {t(locale, 'reports.reportReady')}
                  </span>
                  <h3 className="text-base font-bold text-ink mt-1.5">
                    {t(locale, `reports.type.${built.config.type}`)}
                  </h3>
                  <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                    <span className="font-semibold text-ink">
                      {t(locale, 'reports.understoodAs')}
                    </span>{' '}
                    {describeConfig(built.config, locale)}
                  </p>
                </div>
                <strong className="text-xl font-bold text-ink whitespace-nowrap sm:text-right tabular-nums">
                  {fmt(built.result.total)}
                  <small className="block text-[11px] font-medium text-ink-2 mt-0.5">
                    {built.config.metric === 'count'
                      ? t(locale, 'reports.countLabel')
                      : t(locale, 'reports.total')}
                    {` (${built.result.totalCount})`}
                  </small>
                </strong>
              </div>
              {built.defaulted && (
                <p className="text-xs text-warn-text bg-warn-bg rounded-lg px-3 py-2 mt-3">
                  {t(locale, 'reports.vagueHint')}
                </p>
              )}
              {built.result.rows.length === 0 ? (
                <p className="text-sm text-ink-2 mt-3">
                  {t(locale, 'reports.noRows')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  {built.result.rows.map((row) => (
                    <span
                      key={row.label}
                      className="px-2.5 py-1.5 border border-line rounded-lg bg-surface text-ink-2 text-xs tabular-nums"
                    >
                      {row.label}, {fmt(row.value)}
                      {row.count !== undefined ? ` (${row.count})` : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-line">
                <Button type="button" variant="secondary" onClick={exportBuilt} sm>
                  <Download size={14} />
                  {t(locale, 'reports.exportReport')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={save}
                  disabled={saving}
                  sm
                >
                  {saving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {t(locale, 'reports.saveReport')}
                </Button>
              </div>
            </div>

            {/* Save this report: name the report before saving */}
            <div className="mt-4">
              <Input
                label={<span className="sr-only">{t(locale, 'reports.reportName')}</span>}
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={t(locale, 'reports.reportName')}
                maxLength={80}
              />
            </div>
            {saveMsg && (
              <p className="text-sm text-ok font-medium mt-2" role="status">
                {saveMsg}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Saved reports (prototype `.saved-reports`: count badge, icon rows) */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink">
              {t(locale, 'reports.savedReports')}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              {savedReports.length === 0
                ? t(locale, 'reports.noSaved')
                : t(locale, 'reports.savedReportsReady')}
            </p>
          </div>
          <span className="min-w-[23px] h-[23px] px-2 grid place-items-center rounded-full bg-surface-2 text-ink-2 text-[11px] font-extrabold shrink-0">
            {savedReports.length}
          </span>
        </div>
        {savedReports.length > 0 && (
          <ul className="mt-3 border-t border-line">
            {savedReports.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 py-3 min-h-[54px] border-b border-line last:border-0"
              >
                <span className="w-[30px] h-[30px] grid place-items-center rounded-[9px] bg-ok-bg text-ok shrink-0">
                  <FileText size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {s.name}
                  </p>
                  <p className="text-xs text-ink-2 truncate">{s.prompt}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPrompt(s.prompt);
                    run(s.prompt);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="shrink-0"
                  aria-label={`${t(locale, 'reports.rerun')}: ${s.name}`}
                  title={t(locale, 'reports.rerun')}
                >
                  <Play size={15} />
                  <span className="hidden sm:inline">{t(locale, 'reports.rerun')}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={deletingId === s.id}
                  className="text-ink-2 hover:text-danger hover:bg-danger-bg min-h-[44px] min-w-[44px] px-3 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
                  aria-label={`${t(locale, 'reports.delete')}: ${s.name}`}
                  title={t(locale, 'reports.delete')}
                >
                  {deletingId === s.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
