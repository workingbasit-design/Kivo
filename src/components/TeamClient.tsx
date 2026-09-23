'use client';

import React, { useActionState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, Trash2, UserPlus, ShieldCheck, User } from 'lucide-react';
import { inviteTeamMember, removeTeamMember, type SettingsResult } from '@/app/actions/settings';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Card, EmptyState, Field, StatusBadge, inputClass, primaryBtnClass } from '@/components/ui';

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

function InviteForm() {
  const [state, formAction, isPending] = useActionState<SettingsResult, FormData>(
    inviteTeamMember,
    {}
  );
  const [show, setShow] = React.useState(false);

  return (
    <div>
      {!show ? (
        <button onClick={() => setShow(true)} className={primaryBtnClass}>
          <UserPlus size={14} /> Invite member
        </button>
      ) : (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-zinc-900 mb-4">Invite team member</h3>
          <form action={formAction} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name">
                <input name="name" type="text" required maxLength={100} placeholder="Priya Sharma" className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required maxLength={255} placeholder="priya@example.in" className={inputClass} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Password" hint="Min. 8 characters, with a letter & number">
                <input name="password" type="password" required autoComplete="new-password" className={inputClass} />
              </Field>
              <Field label="Role">
                <select name="role" defaultValue="MEMBER" className={inputClass}>
                  <option value="MEMBER">Member — jobs & customers</option>
                  <option value="ADMIN">Admin — full access</option>
                </select>
              </Field>
            </div>

            {state?.error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}
            {state?.ok && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Team member added.</span>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className={primaryBtnClass}>
                {isPending ? 'Adding…' : 'Add member'}
              </button>
              <button type="button" onClick={() => setShow(false)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runRemove = () => {
    setConfirming(false);
    startTransition(async () => {
      setError(null);
      const res = await removeTeamMember(member.id);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="px-5 py-4 border-b border-zinc-100 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#f5f1fa] text-[#6329d4] flex items-center justify-center shrink-0">
            {member.role === 'ADMIN' ? <ShieldCheck size={18} /> : <User size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">
              {member.name || member.email}
              {isSelf && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">(you)</span>}
            </p>
            <p className="text-xs text-zinc-500 truncate">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={member.role} />
          {!isSelf && (
            <button
              onClick={() => setConfirming(true)}
              disabled={isPending}
              className="text-zinc-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
              title="Remove member"
              aria-label={`Remove ${member.name || member.email}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="text-[11px] text-rose-600 mt-2 font-medium">{error}</p>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Remove ${member.name || member.email}?`}
        message="They will lose access to this business immediately. This cannot be undone."
        confirmLabel="Yes, remove"
        cancelLabel="Keep"
        busy={isPending}
        onConfirm={runRemove}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

export default function TeamClient({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-6">
      <InviteForm />
      <Card>
        {members.length === 0 ? (
          <EmptyState
            icon={<User size={24} />}
            title="No team members"
            description="Invite your staff so everyone can see jobs, customers, and schedules."
          />
        ) : (
          <div>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-zinc-400">
        Admins have full access including team management and settings. Members can manage jobs, customers, quotes, and invoices.
      </p>
    </div>
  );
}
