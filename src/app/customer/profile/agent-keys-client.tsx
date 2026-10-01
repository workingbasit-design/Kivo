'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bot, Check, Copy, KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { generateAgentKeyAction, revokeAgentKeyAction } from '@/app/actions/customer-agent-keys';

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
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60"
    >
      <Plus className="h-4 w-4" />
      {pending ? pendingLabel : label}
    </button>
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
        /* clipboard unavailable — user can select manually */
      }
    };
    return (
      <div className="ej-anim-fade-up rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h2 className="font-bold text-zinc-900">{s.createdTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-600">{s.createdBody}</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white p-3">
          <code className="flex-1 break-all font-mono text-xs text-zinc-800">{genState.key}</code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? s.copied : s.copy}
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-3 w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-shadow hover:shadow-md"
        >
          {s.done}
        </button>
      </div>
    );
  }

  return (
    <div className="ej-anim-fade-up rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm" style={{ animationDelay: '160ms' }}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
          <Bot className="h-4.5 w-4.5" />
        </span>
        <h2 className="font-bold text-zinc-900">{s.title}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>

      <form action={genAction} className="mt-4 flex gap-2">
        <input
          name="label"
          maxLength={60}
          placeholder={s.labelPlaceholder}
          aria-label={s.labelPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
        <CreateButton label={s.create} pendingLabel={s.creating} />
      </form>
      {genState?.error === 'key-limit' && (
        <p className="mt-2 text-sm text-amber-700">{s.limitReached}</p>
      )}

      <div className="mt-4 space-y-2">
        {keys.length === 0 && <p className="text-sm text-zinc-500">{s.empty}</p>}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
          >
            <KeyRound className="h-4 w-4 shrink-0 text-zinc-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-800">{k.label}</p>
              <p className="truncate font-mono text-xs text-zinc-400">
                {k.keyPrefix}… ·{' '}
                {k.revokedAt ? (
                  <span className="font-sans font-medium text-zinc-400">{s.revoked}</span>
                ) : (
                  <span className="font-sans font-medium text-green-700">{s.active}</span>
                )}{' '}
                · {k.lastUsedAt ? s.lastUsed.replace('{when}', fmtDate(k.lastUsedAt)) : s.neverUsed}
              </p>
            </div>
            {!k.revokedAt &&
              (confirmRevoke === k.id ? (
                <form action={revokeAction} className="flex shrink-0 gap-1">
                  <input type="hidden" name="keyId" value={k.id} />
                  <button
                    type="submit"
                    className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-500"
                  >
                    {s.revoke}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(null)}
                    className="rounded-xl bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(k.id)}
                  title={s.revokeConfirm}
                  className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  {s.revoke}
                </button>
              ))}
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-zinc-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
        {s.revokeConfirm}
      </p>
    </div>
  );
}
