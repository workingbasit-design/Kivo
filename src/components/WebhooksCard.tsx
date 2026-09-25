'use client';

import { useState, useTransition } from 'react';
import { Webhook, Plus, Pause, Play, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  Badge,
  Dialog,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from '@/components/ui';

/**
 * Local copy of the server-side event catalog. Client components must not
 * import the server webhooks runtime.
 */
const WEBHOOK_EVENTS = [
  'job.created',
  'job.completed',
  'invoice.created',
  'invoice.paid',
  'customer.created',
  'payment.recorded',
] as const;

export type WebhookEndpointRow = {
  id: string;
  url: string;
  events: string; // JSON array
  active: boolean;
  createdAt: string;
};

export type WebhookDeliveryRow = {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  attempts: number;
  nextRetry: string | null;
  lastError: string | null;
  createdAt: string;
};

export type WebhooksInitial = {
  endpoints: WebhookEndpointRow[];
  deliveries: WebhookDeliveryRow[];
};

function subscribedEvents(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function statusBadge(status: string, tr: (p: string) => string) {
  if (status === 'delivered') return <Badge tone="success">{tr('integrations.statusDelivered')}</Badge>;
  if (status === 'failed') return <Badge tone="danger">{tr('integrations.statusFailed')}</Badge>;
  return <Badge tone="warning">{tr('integrations.statusPending')}</Badge>;
}

export default function WebhooksCard({
  locale,
  initial,
}: {
  locale: Locale;
  initial: WebhooksInitial;
}) {
  const tr = (p: string) => t(locale, p);
  const [data, setData] = useState<WebhooksInitial>(initial);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [pending, startTransition] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    const res = await fetch('/api/integrations/webhooks');
    if (res.ok) {
      const json = (await res.json()) as { data: WebhooksInitial };
      setData(json.data);
    }
  };

  const toggleEvent = (e: string) =>
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const add = () => {
    if (!url.trim() || events.length === 0) return;
    startTransition(async () => {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), events }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? tr('integrations.endpointAdded'));
        return;
      }
      setSecret(json.data.secret as string);
      setUrl('');
      toast.success(tr('integrations.endpointAdded'));
      await refresh();
    });
  };

  const toggleActive = (id: string, active: boolean) => {
    startTransition(async () => {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? '');
        return;
      }
      const json = (await res.json()) as { data: WebhooksInitial };
      setData(json.data);
    });
  };

  const confirmRemove = () => {
    const id = removeId;
    if (!id) return;
    startTransition(async () => {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setRemoveId(null);
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? tr('integrations.endpointRemoved'));
        return;
      }
      toast.success(tr('integrations.endpointRemoved'));
      await refresh();
    });
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success(tr('integrations.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the secret is selectable */
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-900">{tr('integrations.webhooksTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{tr('integrations.webhooksDesc')}</p>
      </div>

      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={tr('integrations.endpointUrlPh')}
          inputMode="url"
          className={inputClass}
        />
        <div>
          <p className="text-xs font-semibold text-zinc-600 mb-1.5">{tr('integrations.eventsLabel')}</p>
          <div className="flex flex-wrap gap-1.5">
            {WEBHOOK_EVENTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggleEvent(e)}
                aria-pressed={events.includes(e)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                  events.includes(e)
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-500 border-zinc-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || !url.trim() || events.length === 0}
          className={primaryBtnClass}
        >
          <Plus size={16} />
          {tr('integrations.addEndpoint')}
        </button>
      </div>

      {data.endpoints.length === 0 ? (
        <p className="text-sm text-zinc-500">{tr('integrations.noEndpoints')}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {data.endpoints.map((ep) => (
            <li key={ep.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Webhook size={18} className="text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate font-mono">{ep.url}</p>
                  <p className="text-xs text-zinc-500 font-mono truncate">
                    {subscribedEvents(ep.events).join(', ')}
                  </p>
                </div>
                {!ep.active && (
                  <Badge className="!bg-zinc-200 !text-zinc-600">{tr('integrations.pause')}</Badge>
                )}
                <button
                  type="button"
                  onClick={() => toggleActive(ep.id, !ep.active)}
                  className={secondaryBtnClass + ' !px-3 !py-1.5 !min-h-0 text-xs shrink-0'}
                >
                  {ep.active ? <Pause size={14} /> : <Play size={14} />}
                  {ep.active ? tr('integrations.pause') : tr('integrations.resume')}
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveId(ep.id)}
                  aria-label={tr('integrations.endpointRemoved')}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-sm font-bold text-zinc-900 mb-2">{tr('integrations.deliveriesTitle')}</h3>
        {data.deliveries.length === 0 ? (
          <p className="text-sm text-zinc-500">{tr('integrations.noDeliveries')}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 max-h-72 overflow-y-auto">
            {data.deliveries.map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-4 py-2.5">
                <code className="text-xs font-mono text-zinc-700">{d.event}</code>
                {statusBadge(d.status, tr)}
                <span className="text-xs text-zinc-400">
                  {d.attempts} {tr('integrations.attempts')}
                </span>
                <span className="text-xs text-zinc-400 ml-auto shrink-0">
                  {new Date(d.createdAt).toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4">
        <h3 className="text-sm font-bold text-zinc-900 mb-2">{tr('integrations.zapierTitle')}</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-zinc-600">
          {[1, 2, 3, 4].map((n) => (
            <li key={n}>{tr(`integrations.zapierStep${n}`)}</li>
          ))}
        </ol>
      </div>

      {/* One-time secret reveal */}
      <Dialog open={secret !== null} onClose={() => setSecret(null)} title={tr('integrations.secretTitle')} locale={locale}>
        <p className="text-sm text-zinc-600 mb-3">{tr('integrations.secretDesc')}</p>
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2.5">
          <code className="flex-1 text-xs font-mono text-zinc-900 break-all select-all">{secret}</code>
          <button type="button" onClick={copySecret} className={secondaryBtnClass + ' !px-3 !py-1.5 !min-h-0 text-xs shrink-0'}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setSecret(null)} className={primaryBtnClass}>
            {tr('integrations.copied')}
          </button>
        </div>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={removeId !== null} onClose={() => setRemoveId(null)} title={tr('integrations.removeConfirm')} locale={locale}>
        <p className="text-sm text-zinc-600 font-mono break-all">
          {data.endpoints.find((e) => e.id === removeId)?.url}
        </p>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={() => setRemoveId(null)} className={secondaryBtnClass}>
            {t(locale, 'credentials.cancel')}
          </button>
          <button type="button" onClick={confirmRemove} disabled={pending} className={dangerBtnClass}>
            {tr('integrations.endpointRemoved')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
