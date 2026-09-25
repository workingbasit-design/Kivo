'use client';

import { useState, useTransition } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Badge, primaryBtnClass } from '@/components/ui';
import type { SyncOutcome } from '@/lib/googleCalendarSync';

export type CalendarInitial = {
  connected: boolean;
  needsScope: boolean;
  lastSyncAt: string | null;
};

export default function GoogleCalendarCard({
  locale,
  initial,
  onSync,
}: {
  locale: Locale;
  initial: CalendarInitial;
  onSync: () => Promise<SyncOutcome>;
}) {
  const tr = (p: string) => t(locale, p);
  const [state, setState] = useState<CalendarInitial>(initial);
  const [pending, startTransition] = useTransition();

  const sync = () => {
    startTransition(async () => {
      const res = await onSync();
      if (res.ok) {
        toast.success(
          `${tr('integrations.calendarSynced')} (+${res.created}/~${res.updated}/−${res.deleted})`
        );
        setState((s) => ({ ...s, lastSyncAt: new Date().toISOString() }));
      } else if (res.reason === 'needs-scope') {
        setState((s) => ({ ...s, needsScope: true }));
        toast.error(tr('integrations.calendarNeedsScope'));
      } else {
        toast.error(tr('integrations.calendarSyncFailed'));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-900">{tr('integrations.calendarTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{tr('integrations.calendarDesc')}</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
        <CalendarDays size={20} className="text-zinc-400 shrink-0" />
        <div className="min-w-0 flex-1">
          {state.connected && !state.needsScope ? (
            <>
              <p className="text-sm font-semibold text-zinc-900">{tr('integrations.calendarConnected')}</p>
              {state.lastSyncAt && (
                <p className="text-xs text-zinc-500">
                  {tr('integrations.lastUsed')}: {new Date(state.lastSyncAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </>
          ) : state.needsScope ? (
            <p className="text-sm text-amber-700">{tr('integrations.calendarNeedsScope')}</p>
          ) : (
            <p className="text-sm text-zinc-500">{tr('integrations.calendarNotConnected')}</p>
          )}
        </div>
        {state.connected && !state.needsScope && <Badge tone="success">Google</Badge>}
      </div>

      <div className="flex flex-wrap gap-2">
        {!state.connected || state.needsScope ? (
          <a href="/api/google/connect" className={primaryBtnClass}>
            {tr('integrations.connectGoogle')}
          </a>
        ) : (
          <button type="button" onClick={sync} disabled={pending} className={primaryBtnClass}>
            <RefreshCw size={16} className={pending ? 'animate-spin' : ''} />
            {tr('integrations.calendarSyncNow')}
          </button>
        )}
      </div>
    </div>
  );
}
