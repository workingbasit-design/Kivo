'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Plus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  Badge,
  Dialog,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  selectClass,
} from '@/components/ui';

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type CreatedKey = ApiKeyRow & { key: string };

function scopeLabel(scopes: string, tr: (p: string) => string): string {
  return scopes.includes('write') ? tr('integrations.scopeWrite') : tr('integrations.scopeRead');
}

export default function ApiKeysCard({
  locale,
  initial,
}: {
  locale: Locale;
  initial: ApiKeyRow[];
}) {
  const tr = (p: string) => t(locale, p);
  const [keys, setKeys] = useState<ApiKeyRow[]>(initial);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    const res = await fetch('/api/integrations/api-keys');
    if (res.ok) {
      const json = (await res.json()) as { data: ApiKeyRow[] };
      setKeys(json.data);
    }
  };

  const create = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/integrations/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scope }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? tr('integrations.keyCreated'));
        return;
      }
      setCreated(json.data as CreatedKey);
      setName('');
      toast.success(tr('integrations.keyCreated'));
      await refresh();
    });
  };

  const confirmRevoke = () => {
    const id = revokeId;
    if (!id) return;
    startTransition(async () => {
      const res = await fetch('/api/integrations/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setRevokeId(null);
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? tr('integrations.revoked'));
        return;
      }
      toast.success(tr('integrations.revoked'));
      await refresh();
    });
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      toast.success(tr('integrations.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the key is selectable */
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-900">{tr('integrations.apiKeysTitle')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{tr('integrations.apiKeysDesc')}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr('integrations.keyNamePh')}
          maxLength={60}
          className={inputClass}
        />
        <select value={scope} onChange={(e) => setScope(e.target.value as 'read' | 'write')} className={selectClass}>
          <option value="read">{tr('integrations.scopeRead')}</option>
          <option value="write">{tr('integrations.scopeWrite')}</option>
        </select>
        <button
          type="button"
          onClick={create}
          disabled={pending || !name.trim()}
          className={primaryBtnClass}
        >
          <Plus size={16} />
          {tr('integrations.createKey')}
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-zinc-500">{tr('integrations.noKeys')}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3">
              <KeyRound size={18} className="text-zinc-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 truncate">{k.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{k.keyPrefix}…</p>
                <p className="text-xs text-zinc-400">
                  {tr('integrations.lastUsed')}:{' '}
                  {k.lastUsedAt
                    ? new Date(k.lastUsedAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')
                    : tr('integrations.neverUsed')}
                </p>
              </div>
              <Badge>{scopeLabel(k.scopes, tr)}</Badge>
              {!k.revokedAt && (
                <button
                  type="button"
                  onClick={() => setRevokeId(k.id)}
                  className={dangerBtnClass + ' !px-3 !py-1.5 !min-h-0 text-xs'}
                >
                  {tr('integrations.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* One-time key reveal */}
      <Dialog open={created !== null} onClose={() => setCreated(null)} title={tr('integrations.keyCreatedTitle')} locale={locale}>
        <p className="text-sm text-zinc-600 mb-3">{tr('integrations.keyCreatedDesc')}</p>
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2.5">
          <code className="flex-1 text-xs font-mono text-zinc-900 break-all select-all">{created?.key}</code>
          <button type="button" onClick={copyKey} className={secondaryBtnClass + ' !px-3 !py-1.5 !min-h-0 text-xs shrink-0'}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setCreated(null)} className={primaryBtnClass}>
            {tr('integrations.copied')}
          </button>
        </div>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={revokeId !== null} onClose={() => setRevokeId(null)} title={tr('integrations.revokeConfirm')} locale={locale}>
        <p className="text-sm text-zinc-600">{keys.find((k) => k.id === revokeId)?.name}</p>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={() => setRevokeId(null)} className={secondaryBtnClass}>
            {t(locale, 'credentials.cancel')}
          </button>
          <button type="button" onClick={confirmRevoke} disabled={pending} className={dangerBtnClass}>
            {tr('integrations.revoke')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
