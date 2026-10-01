'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { approveProposal, declineProposal, claimAgentAccount } from '@/app/actions/agent-confirm';

function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

const approveBtn =
  'w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none';
const declineBtn =
  'w-full rounded-2xl px-6 py-3 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 hover:bg-zinc-100 disabled:opacity-60';

/** Big Approve / subtle Decline buttons for a pending proposal. */
export function ProposalActions({
  token,
  approveLabel,
  approvingLabel,
  declineLabel,
}: {
  token: string;
  approveLabel: string;
  approvingLabel: string;
  declineLabel: string;
}) {
  const [approveState, approveAction] = useActionState(approveProposal, null);
  const [, declineAction] = useActionState(declineProposal, null);
  return (
    <div className="space-y-2">
      <form action={approveAction}>
        <input type="hidden" name="token" value={token} />
        {approveState?.error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{approveState.error}</p>
        )}
        <SubmitButton label={approveLabel} pendingLabel={approvingLabel} className={approveBtn} />
      </form>
      <form action={declineAction}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton label={declineLabel} pendingLabel={declineLabel} className={declineBtn} />
      </form>
    </div>
  );
}

/** Set-a-password form that claims an agent-created account and signs in. */
export function ClaimAccountForm({
  token,
  passwordLabel,
  confirmLabel,
  ctaLabel,
  creatingLabel,
}: {
  token: string;
  passwordLabel: string;
  confirmLabel: string;
  ctaLabel: string;
  creatingLabel: string;
}) {
  const [state, action] = useActionState(claimAgentAccount, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}
      <div>
        <label htmlFor="claim-password" className="mb-1 block text-sm font-medium text-zinc-700">
          {passwordLabel}
        </label>
        <input
          id="claim-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
      </div>
      <div>
        <label htmlFor="claim-confirm" className="mb-1 block text-sm font-medium text-zinc-700">
          {confirmLabel}
        </label>
        <input
          id="claim-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
      </div>
      <SubmitButton label={ctaLabel} pendingLabel={creatingLabel} className={approveBtn} />
    </form>
  );
}
