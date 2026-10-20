'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bot, Check, Copy, KeyRound, Plus, ShieldCheck } from '@/components/icons';
import { generateAgentKeyAction, revokeAgentKeyAction } from '@/app/actions/customer-agent-keys';
import { Button, Card } from '@/components/kit';

type KeyRow = {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

type Strings = {
  title: string;
  body: string;
  labelPlaceholder: string;
  create: string;
  creating: string;
  limitReached: string;
  createdTitle: string;
  createdBody: string;
  copy: string;
  copied: string;
  done: string;
  revoke: string;
  revokeConfirm: string;
  revoked: string;
  active: string;
  lastUsed: string;
  neverUsed: string;
  empty: string;
};

function CreateButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" sm disabled={pending}>
      <Plus className="h-4 w-4" />
      {pending ? pendingLabel : label}
    </Button>
  );
}

export default function AgentKeysSection({ keys, s, locale }: { keys: KeyRow[]; s: Strings; locale: string }) {
  const router = useRouter();
  const [genState, genAction] = useActionState(generateAgentKeyAction, null);
  const [, revokeAction] = useActionState(revokeAgentKeyAction, null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  // Freshly generated key: show once, never again.
  if (genState?.key) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(genState.key!);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard unavailable - user can select manually */
      }
    };
    return (
      <div className="ej-anim-fade-up">
        <Card className="p-5 bg-surface-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-ink" />
            <h2 className="font-bold text-ink">{s.createdTitle}</h2>
          </div>
          <p className="mt-1 text-sm text-ink-2">{s.createdBody}</p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface p-3">
            <code className="flex-1 break-all font-mono text-xs text-ink">{genState.key}</code>
            <Button type="button" sm onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? s.copied : s.copy}
            </Button>
          </div>
          <Button type="button" variant="secondary" block onClick={() => router.refresh()} className="mt-3">
            {s.done}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="ej-anim-fade-up" style={{ animationDelay: '160ms' }}>
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-asphalt shrink-0">
            <Bot className="h-4 w-4 text-lime" />
          </span>
          <h2 className="font-bold text-ink">{s.title}</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>

        <form action={genAction} className="mt-4 flex gap-2">
          <input
            name="label"
            maxLength={60}
            placeholder={s.labelPlaceholder}
            aria-label={s.labelPlaceholder}
            className="input min-w-0 flex-1 !min-h-[44px]"
          />
          <CreateButton label={s.create} pendingLabel={s.creating} />
        </form>
        {genState?.error === 'key-limit' && (
          <p className="mt-2 text-sm text-warn-text">{s.limitReached}</p>
        )}

        <div className="mt-4 space-y-2">
          {keys.length === 0 && <p className="text-sm text-ink-2">{s.empty}</p>}
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-ink-2" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{k.label}</p>
                <p className="truncate font-mono text-xs text-ink-2">
                  {k.keyPrefix}… ·{' '}
                  {k.revokedAt ? (
                    <span className="font-sans font-medium text-ink-2">{s.revoked}</span>
                  ) : (
                    <span className="font-sans font-medium text-ok">{s.active}</span>
                  )}{' '}
                  · {k.lastUsedAt ? s.lastUsed.replace('{when}', fmtDate(k.lastUsedAt)) : s.neverUsed}
                </p>
              </div>
              {!k.revokedAt &&
                (confirmRevoke === k.id ? (
                  <form action={revokeAction} className="flex shrink-0 gap-1">
                    <input type="hidden" name="keyId" value={k.id} />
                    <Button type="submit" sm variant="danger">
                      {s.revoke}
                    </Button>
                    <Button type="button" sm variant="secondary" onClick={() => setConfirmRevoke(null)}>
                      ✕
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(k.id)}
                    title={s.revokeConfirm}
                    className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-bg min-h-[44px]"
                  >
                    {s.revoke}
                  </button>
                ))}
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-2" />
          {s.revokeConfirm}
        </p>
      </Card>
    </div>
  );
}
