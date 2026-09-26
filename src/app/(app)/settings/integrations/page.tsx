import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card } from '@/components/ui';
import GoogleCalendarCard, { type CalendarInitial } from '@/components/GoogleCalendarCard';
import QuickBooksCard from '@/components/QuickBooksCard';
import { SCOPE_CALENDAR_WRITE, type SyncOutcome } from '@/lib/googleCalendarSync';

export const metadata = { title: 'Integrations | EveryJob' };

/**
 * Phase 1: QuickBooks is deferred. The card, routes, and sync engine stay
 * live — only the card is hidden from this page. Set to true when the
 * integration graduates back into Phase 1.
 */
const SHOW_QUICKBOOKS_CARD = false;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function runCalendarSync(): Promise<SyncOutcome> {
  'use server';
  const { businessId } = await requireAuth();
  // Import inside the action so the page bundle stays light.
  const { syncJobsToGoogleCalendar } = await import('@/lib/googleCalendarSync');
  return syncJobsToGoogleCalendar(businessId);
}

export default async function IntegrationsPage() {
  const { businessId } = await requireAuth();
  const locale = await getLocale();
  const tr = (p: string) => t(locale, p);

  // NOTE (2026-09-26): the API-keys and webhooks cards used to live on this
  // page. They were removed at the owner's request — developer tooling that
  // confused non-technical users. The underlying /api/v1 routes and webhook
  // delivery engine remain in the codebase but are no longer surfaced in UI.
  const [googleConn, qbConn] = await Promise.all([
    prisma.googleConnection.findUnique({
      where: { businessId },
      select: { scopes: true, lastSyncAt: true },
    }),
    prisma.quickBooksConnection.findUnique({
      where: { businessId },
      select: { id: true, lastSyncAt: true },
    }),
  ]);

  const granted = (googleConn?.scopes ?? '').split(/\s+/).filter(Boolean);
  const calendarInitial: CalendarInitial = {
    connected: granted.some((s) => s.includes('calendar')),
    needsScope: granted.length > 0 && !granted.includes(SCOPE_CALENDAR_WRITE),
    lastSyncAt: iso(googleConn?.lastSyncAt),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={tr('integrations.title')} subtitle={tr('integrations.subtitle')} />
      <Card>
        <GoogleCalendarCard locale={locale} initial={calendarInitial} onSync={runCalendarSync} />
      </Card>
      {/* Phase 1: QuickBooks card hidden but implementation retained (see SHOW_QUICKBOOKS_CARD). */}
      {SHOW_QUICKBOOKS_CARD && (
        <Card>
          <QuickBooksCard
            locale={locale}
            initialConnected={!!qbConn}
            initialLastSyncAt={iso(qbConn?.lastSyncAt)}
            sandbox={process.env.QUICKBOOKS_SANDBOX === 'true'}
          />
        </Card>
      )}
    </div>
  );
}
