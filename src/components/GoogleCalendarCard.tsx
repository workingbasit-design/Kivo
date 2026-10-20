'use client';

import { useState, useTransition } from 'react';
import { CalendarDays, RefreshCw } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import { Button, StatusBadge } from '@/components/kit';
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
        <h2 className="text-base font-bold text-ink">{tr('integrations.calendarTitle')}</h2>
        <p className="text-sm text-ink-2 mt-1">{tr('integrations.calendarDesc')}</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
        <CalendarDays size={20} className="text-ink-2 shrink-0" />
        <div className="min-w-0 flex-1">
          {state.connected && !state.needsScope ? (
            <>
              <p className="text-sm font-semibold text-ink">{tr('integrations.calendarConnected')}</p>
              {state.lastSyncAt && (
                <p className="text-xs text-ink-2">
                  {tr('integrations.lastUsed')}: {new Date(state.lastSyncAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </>
          ) : state.needsScope ? (
            <p className="text-sm text-warn-text">{tr('integrations.calendarNeedsScope')}</p>
          ) : (
            <p className="text-sm text-ink-2">{tr('integrations.calendarNotConnected')}</p>
          )}
        </div>
        {state.connected && !state.needsScope && <StatusBadge tone="done">Google</StatusBadge>}
      </div>

      <div className="flex flex-wrap gap-2">
        {!state.connected || state.needsScope ? (
          <Button href="/api/google/connect" variant="primary">
            {tr('integrations.connectGoogle')}
          </Button>
        ) : (
          <Button
            variant="primary"
            type="button"
            onClick={sync}
            disabled={pending}
            className="disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={pending ? 'animate-spin' : ''} />
            {tr('integrations.calendarSyncNow')}
          </Button>
        )}
      </div>
    </div>
  );
}
