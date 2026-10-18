'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Play, Trash2, Loader2, Save } from '@/components/icons';
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

/** "Revenue · grouped by month · last 30 days" - shows the user what was parsed. */
function describeConfig(config: ReportConfig, locale: Locale): string {
  const parts = [
    t(locale, `reports.type.${config.type}`),
    t(locale, `reports.groupBy.${config.groupBy}`),
    t(locale, `reports.range.${config.dateRange}`),
  ];
  if (config.metric !== 'total') {
    parts.push(t(locale, `reports.metric.${config.metric}`));
  }
  return parts.join(' · ');
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

  return (
    <div className="space-y-6">
      {/* Builder */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <Sparkles size={15} className="text-ink" />
          {t(locale, 'reports.builderTitle')}
        </h2>
        <p className="text-xs text-ink-2 mt-1 mb-4">
          {t(locale, 'reports.builderSubtitle')}
        </p>

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
              className="text-xs font-medium text-ink-2 bg-surface-2 hover:bg-line rounded-full px-3 py-2 min-h-[44px] transition-colors"
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
            <p className="text-xs text-ink-2">
              <span className="font-semibold text-ink">
                {t(locale, 'reports.understoodAs')}
              </span>{' '}
              {describeConfig(built.config, locale)}
            </p>
            {built.defaulted && (
              <p className="text-xs text-warn-text bg-warn-bg rounded-lg px-3 py-2 mt-2">
                {t(locale, 'reports.vagueHint')}
              </p>
            )}

            {built.result.rows.length === 0 ? (
              <p className="text-sm text-ink-2 mt-4">
                {t(locale, 'reports.noRows')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-2 font-semibold border-b border-line">
                      <th className="py-2 pr-3 font-semibold"> </th>
                      <th className="py-2 pr-3 font-semibold text-right">
                        {t(locale, 'reports.countLabel')}
                      </th>
                      <th className="py-2 font-semibold text-right">
                        {built.config.metric === 'count'
                          ? t(locale, 'reports.countLabel')
                          : t(locale, 'reports.total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {built.result.rows.map((row) => (
                      <tr
                        key={row.label}
                        className="border-b border-line last:border-0"
                      >
                        <td className="py-2.5 pr-3 font-medium text-ink">
                          {row.label}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-ink-2 tabular-nums">
                          {row.count ?? '-'}
                        </td>
                        <td className="py-2.5 text-right font-bold text-ink tabular-nums">
                          {fmt(row.value)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-surface-2">
                      <td className="py-2.5 pr-3 font-bold text-ink">
                        {t(locale, 'reports.total')}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-ink-2 tabular-nums font-semibold">
                        {built.result.totalCount}
                      </td>
                      <td className="py-2.5 text-right font-bold text-ink tabular-nums">
                        {fmt(built.result.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Save this report */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2 items-start">
              <div className="w-full min-w-0">
                <Input
                  label={<span className="sr-only">{t(locale, 'reports.reportName')}</span>}
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t(locale, 'reports.reportName')}
                  maxLength={80}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={save}
                disabled={saving}
                className="shrink-0"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {t(locale, 'reports.saveReport')}
              </Button>
            </div>
            {saveMsg && (
              <p className="text-sm text-ok font-medium mt-2" role="status">
                {saveMsg}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Saved reports */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-1">
          {t(locale, 'reports.savedReports')}
        </h2>
        {savedReports.length === 0 ? (
          <p className="text-sm text-ink-2 mt-2">{t(locale, 'reports.noSaved')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {savedReports.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 py-3 min-h-[44px]"
              >
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
