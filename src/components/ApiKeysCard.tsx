'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Plus, Copy, Check } from '@/components/icons';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import {
  BottomSheet,
  Button,
  StatusBadge,
} from '@/components/kit';

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
      /* clipboard unavailable - the key is selectable */
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-ink">{tr('integrations.apiKeysTitle')}</h2>
        <p className="text-sm text-ink-2 mt-1">{tr('integrations.apiKeysDesc')}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr('integrations.keyNamePh')}
          maxLength={60}
          className="input"
          aria-label={tr('integrations.keyNamePh')}
        />
        <span className="select sm:w-auto w-full">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as 'read' | 'write')}
            className="input"
          >
            <option value="read">{tr('integrations.scopeRead')}</option>
            <option value="write">{tr('integrations.scopeWrite')}</option>
          </select>
        </span>
        <Button
          variant="primary"
          type="button"
          onClick={create}
          disabled={pending || !name.trim()}
          className="disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {tr('integrations.createKey')}
        </Button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-ink-2">{tr('integrations.noKeys')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3">
              <KeyRound size={18} className="text-ink-2 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{k.name}</p>
                <p className="text-xs text-ink-2 font-mono">{k.keyPrefix}…</p>
                <p className="text-xs text-ink-2">
                  {tr('integrations.lastUsed')}:{' '}
                  {k.lastUsedAt
                    ? new Date(k.lastUsedAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA')
                    : tr('integrations.neverUsed')}
                </p>
              </div>
              <StatusBadge tone="neutral">{scopeLabel(k.scopes, tr)}</StatusBadge>
              {!k.revokedAt && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => setRevokeId(k.id)}
                  className="!px-3 !py-1.5 !min-h-0 text-xs"
                >
                  {tr('integrations.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* One-time key reveal */}
      <BottomSheet
        open={created !== null}
        onClose={() => setCreated(null)}
        title={tr('integrations.keyCreatedTitle')}
        footer={
          <div className="mt-4 flex justify-end">
            <Button variant="primary" type="button" onClick={() => setCreated(null)}>
              {tr('integrations.copied')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2 mb-3">{tr('integrations.keyCreatedDesc')}</p>
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
          <code className="flex-1 text-xs font-mono text-ink break-all select-all">{created?.key}</code>
          <Button
            variant="secondary"
            type="button"
            onClick={copyKey}
            className="!px-3 !py-1.5 !min-h-0 text-xs shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      </BottomSheet>

      {/* Revoke confirmation */}
      <BottomSheet
        open={revokeId !== null}
        onClose={() => setRevokeId(null)}
        title={tr('integrations.revokeConfirm')}
        footer={
          <div className="mt-5 flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setRevokeId(null)}>
              {t(locale, 'credentials.cancel')}
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={confirmRevoke}
              disabled={pending}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {tr('integrations.revoke')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-2">{keys.find((k) => k.id === revokeId)?.name}</p>
      </BottomSheet>
    </div>
  );
}
