'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Card, secondaryBtnClass } from '@/components/ui';
import {
  setWorkflowRuleEnabled,
  updateWorkflowRuleConfig,
  runWorkflowsNow,
} from '@/app/actions/automations';
import type { WorkflowTrigger } from '@/lib/workflows';

type Rule = {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  enabled: boolean;
  configJson: string | null;
};

type LogRow = { id: string; kind: string; summary: string; createdAt: string };

function parseConfig(raw: string | null): Record<string, number | boolean> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, number | boolean>) : {};
  } catch {
    return {};
  }
}

function timeAgo(iso: string, locale: Locale): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t(locale, 'track8.justNow');
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function RuleSwitch({
  enabled,
  onToggle,
  disabled,
  label,
  locale,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled: boolean;
  label: string;
  locale: Locale;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${label} — ${enabled ? t(locale, 'track8.enabled') : t(locale, 'track8.disabled')}`}
      disabled={disabled}
      onClick={onToggle}
      className="shrink-0 inline-flex items-center gap-2 min-h-[44px] rounded-full px-2 disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
      <span
        className={`text-xs font-bold ${enabled ? 'text-emerald-700' : 'text-zinc-400'}`}
      >
        {enabled ? t(locale, 'track8.enabled') : t(locale, 'track8.disabled')}
      </span>
    </button>
  );
}

export default function AutomationsClient({
  locale,
  initial,
}: {
  locale: Locale;
  initial: { rules: Rule[]; logs: LogRow[]; triggers: WorkflowTrigger[] };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, number | boolean>>>({});

  const draftOf = (r: Rule): Record<string, number | boolean> => drafts[r.id] ?? parseConfig(r.configJson);

  const save = (rule: Rule) =>
    startTransition(async () => {
      const d = draftOf(rule);
      const res = await updateWorkflowRuleConfig(rule.id, {
        followUpDays: typeof d.followUpDays === 'number' ? d.followUpDays : undefined,
        graceDays: typeof d.graceDays === 'number' ? d.graceDays : undefined,
        reviewDraft: typeof d.reviewDraft === 'boolean' ? d.reviewDraft : undefined,
      });
      if (res.error) {
        setNotice({ ok: false, text: res.error });
        toast.error(res.error);
      } else {
        setNotice({ ok: true, text: t(locale, 'track8.saved') });
        toast.success(t(locale, 'track8.saved'));
        router.refresh();
      }
    });

  const toggle = (rule: Rule, enabled: boolean) =>
    startTransition(async () => {
      const res = await setWorkflowRuleEnabled(rule.id, enabled);
      if (res.error) {
        setNotice({ ok: false, text: res.error });
        toast.error(res.error);
      } else {
        toast.success(
          `${t(locale, `track8.trigger_${rule.trigger}`)} — ${
            enabled ? t(locale, 'track8.enabled') : t(locale, 'track8.disabled')
          }`
        );
        router.refresh();
      }
    });

  const runNow = () =>
    startTransition(async () => {
      const res = await runWorkflowsNow();
      if (res.error) {
        setNotice({ ok: false, text: res.error });
        toast.error(res.error);
      } else {
        const text = t(locale, 'track8.runNowDone')
          .replace('{fired}', String(res.fired ?? 0))
          .replace('{rules}', String(res.rulesEvaluated ?? 0));
        setNotice({ ok: true, text });
        toast.success(text);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role={notice.ok ? 'status' : 'alert'}
          className={`flex items-start gap-2 text-xs font-medium rounded-xl px-3 py-2.5 border ${
            notice.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {initial.rules.map((rule) => {
        const d = draftOf(rule);
        return (
          <Card key={rule.id} className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Zap size={14} className="text-amber-500 shrink-0" />
                  {t(locale, `track8.trigger_${rule.trigger}`)}
                </h2>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {t(locale, `track8.trigger_${rule.trigger}_hint`)}
                </p>
              </div>
              <RuleSwitch
                enabled={rule.enabled}
                disabled={pending}
                onToggle={() => toggle(rule, !rule.enabled)}
                label={t(locale, `track8.trigger_${rule.trigger}`)}
                locale={locale}
              />
            </div>

            {rule.enabled && (
              <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                {rule.trigger === 'QUOTE_AWAITING' && (
                  <label className="text-xs font-semibold text-zinc-700 flex flex-col gap-1.5">
                    {t(locale, 'track8.followUpDays')}
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={String(d.followUpDays ?? 3)}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [rule.id]: { ...d, followUpDays: Number(e.target.value) },
                        }))
                      }
                      className="w-full sm:w-24 min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm"
                    />
                  </label>
                )}
                {rule.trigger === 'INVOICE_OVERDUE' && (
                  <label className="text-xs font-semibold text-zinc-700 flex flex-col gap-1.5">
                    {t(locale, 'track8.graceDays')}
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={String(d.graceDays ?? 14)}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [rule.id]: { ...d, graceDays: Number(e.target.value) },
                        }))
                      }
                      className="w-full sm:w-24 min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm"
                    />
                  </label>
                )}
                {rule.trigger === 'JOB_COMPLETED' && (
                  <label className="text-xs font-semibold text-zinc-700 inline-flex items-center gap-2.5 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={d.reviewDraft !== false}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [rule.id]: { ...d, reviewDraft: e.target.checked },
                        }))
                      }
                      className="w-5 h-5 rounded accent-ink shrink-0"
                    />
                    {t(locale, 'track8.reviewDraft')}
                  </label>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(rule)}
                  className={`${secondaryBtnClass} sm:w-auto w-full`}
                >
                  {t(locale, 'track8.save')}
                </button>
              </div>
            )}
          </Card>
        );
      })}

      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">{t(locale, 'track8.runNow')}</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {t(locale, 'track8.automationsSubtitle')}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={runNow}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center bg-ink hover:bg-graphite disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {pending ? '…' : t(locale, 'track8.runNow')}
          </button>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-3">{t(locale, 'track8.recentActivity')}</h2>
        {initial.logs.length === 0 ? (
          <p className="text-xs text-zinc-500">{t(locale, 'track8.noActivity')}</p>
        ) : (
          <ul className="space-y-2.5">
            {initial.logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <span className="inline-block font-bold text-zinc-700 bg-zinc-100 rounded px-1.5 py-0.5 mr-2">
                    {l.kind}
                  </span>
                  <span className="text-zinc-600">{l.summary}</span>
                </div>
                <span className="text-zinc-400 shrink-0">{timeAgo(l.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
