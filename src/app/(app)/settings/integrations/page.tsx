import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { PageHeader, Card } from '@/components/ui';
import ApiKeysCard, { type ApiKeyRow } from '@/components/ApiKeysCard';
import WebhooksCard, {
  type WebhooksInitial,
  type WebhookEndpointRow,
  type WebhookDeliveryRow,
} from '@/components/WebhooksCard';
import GoogleCalendarCard, { type CalendarInitial } from '@/components/GoogleCalendarCard';
import QuickBooksCard from '@/components/QuickBooksCard';
import { SCOPE_CALENDAR_WRITE, type SyncOutcome } from '@/lib/googleCalendarSync';

export const metadata = { title: 'Integrations | EveryJob' };

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

  const [keys, endpoints, deliveries, googleConn, qbConn] = await Promise.all([
    prisma.apiKey.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    }),
    prisma.webhookEndpoint.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
    }),
    prisma.webhookDelivery.findMany({
      where: { endpoint: { businessId } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        endpointId: true,
        event: true,
        status: true,
        attempts: true,
        nextRetry: true,
        lastError: true,
        createdAt: true,
      },
    }),
    prisma.googleConnection.findUnique({
      where: { businessId },
      select: { scopes: true, lastSyncAt: true },
    }),
    prisma.quickBooksConnection.findUnique({
      where: { businessId },
      select: { id: true, lastSyncAt: true },
    }),
  ]);

  const keyRows: ApiKeyRow[] = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    lastUsedAt: iso(k.lastUsedAt),
    revokedAt: iso(k.revokedAt),
    createdAt: k.createdAt.toISOString(),
  }));

  const endpointRows: WebhookEndpointRow[] = endpoints.map((e) => ({
    id: e.id,
    url: e.url,
    events: e.events,
    active: e.active,
    createdAt: e.createdAt.toISOString(),
  }));

  const deliveryRows: WebhookDeliveryRow[] = deliveries.map((d) => ({
    id: d.id,
    endpointId: d.endpointId,
    event: d.event,
    status: d.status,
    attempts: d.attempts,
    nextRetry: iso(d.nextRetry),
    lastError: d.lastError,
    createdAt: d.createdAt.toISOString(),
  }));

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
        <ApiKeysCard locale={locale} initial={keyRows} />
      </Card>
      <Card>
        <WebhooksCard
          locale={locale}
          initial={{ endpoints: endpointRows, deliveries: deliveryRows } satisfies WebhooksInitial}
        />
      </Card>
      <Card>
        <GoogleCalendarCard locale={locale} initial={calendarInitial} onSync={runCalendarSync} />
      </Card>
      <Card>
        <QuickBooksCard
          locale={locale}
          initialConnected={!!qbConn}
          initialLastSyncAt={iso(qbConn?.lastSyncAt)}
          sandbox={process.env.QUICKBOOKS_SANDBOX === 'true'}
        />
      </Card>
      <p className="text-xs text-zinc-400">{tr('integrations.docsNote')}</p>
    </div>
  );
}
