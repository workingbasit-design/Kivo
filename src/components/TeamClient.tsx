'use client';

import React, { useActionState, useEffect, useTransition } from 'react';
import { AlertCircle, Trash2, UserPlus, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { inviteTeamMember, removeTeamMember, type SettingsResult } from '@/app/actions/settings';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Card, EmptyState, Field, StatusBadge, inputClass, primaryBtnClass } from '@/components/ui';
import { useResolvedT } from '@/hooks/useResolvedLocale';

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

function InviteForm() {
  const { t } = useResolvedT();
  const [state, formAction, isPending] = useActionState<SettingsResult, FormData>(
    inviteTeamMember,
    {}
  );
  const [show, setShow] = React.useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t('t10misc.team.added'));
      setShow(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, t]);

  return (
    <div>
      {!show ? (
        <button onClick={() => setShow(true)} className={primaryBtnClass}>
          <UserPlus size={14} /> {t('t10misc.team.inviteMember')}
        </button>
      ) : (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-zinc-900 mb-4">{t('t10misc.team.inviteTitle')}</h3>
          <form action={formAction} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('t10misc.team.nameLabel')}>
                <input name="name" type="text" required maxLength={100} placeholder={t('t10misc.team.namePlaceholder')} className={inputClass} />
              </Field>
              <Field label={t('t10misc.team.emailLabel')}>
                <input name="email" type="email" required maxLength={255} placeholder={t('t10misc.team.emailPlaceholder')} className={inputClass} autoComplete="email" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('t10misc.team.passwordLabel')} hint={t('t10misc.team.passwordHint')}>
                <input name="password" type="password" required autoComplete="new-password" className={inputClass} />
              </Field>
              <Field label={t('t10misc.team.roleLabel')}>
                <select name="role" defaultValue="MEMBER" className={inputClass}>
                  <option value="MEMBER">{t('t10misc.team.roleMember')}</option>
                  <option value="ADMIN">{t('t10misc.team.roleAdmin')}</option>
                </select>
              </Field>
            </div>

            {state?.error && (
              <div role="alert" className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button type="submit" disabled={isPending} className={primaryBtnClass}>
                {isPending ? t('t10misc.team.adding') : t('t10misc.team.addMember')}
              </button>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
              >
                {t('t10misc.team.cancel')}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const { t } = useResolvedT();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runRemove = () => {
    setConfirming(false);
    startTransition(async () => {
      setError(null);
      const res = await removeTeamMember(member.id);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(t('t10misc.team.removed'));
      }
    });
  };

  const displayName = member.name || member.email;

  return (
    <div className="px-5 py-4 border-b border-zinc-100 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-smoke text-ink flex items-center justify-center shrink-0">
            {member.role === 'ADMIN' ? <ShieldCheck size={18} /> : <User size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">
              {displayName}
              {isSelf && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('t10misc.team.you')}</span>}
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
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-zinc-400 hover:text-rose-600 p-2.5 rounded-lg hover:bg-rose-50 transition-colors"
              aria-label={t('t10misc.team.removeTitle').replace('{name}', displayName)}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="text-[11px] text-rose-600 mt-2 font-medium" role="alert">{error}</p>
      )}
      <ConfirmDialog
        open={confirming}
        title={t('t10misc.team.removeTitle').replace('{name}', displayName)}
        message={t('t10misc.team.removeMessage')}
        confirmLabel={t('t10misc.team.removeConfirm')}
        cancelLabel={t('t10misc.team.keep')}
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
  const { t } = useResolvedT();
  return (
    <div className="space-y-6">
      <InviteForm />
      <Card className="p-0 overflow-hidden">
        {members.length === 0 ? (
          <EmptyState
            icon={<User size={24} />}
            title={t('t10misc.team.noMembersTitle')}
            description={t('t10misc.team.noMembersDesc')}
          />
        ) : (
          <div>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-zinc-400 leading-relaxed">{t('t10misc.team.rolesHint')}</p>
    </div>
  );
}
