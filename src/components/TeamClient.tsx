'use client';

import React, { useActionState, useTransition } from 'react';
import { AlertCircle, Trash2, UserPlus, ShieldCheck, User } from '@/components/icons';
import { toast } from 'sonner';
import {
  inviteTeamMember,
  removeTeamMember,
  suspendTeamMember,
  unsuspendTeamMember,
  changeTeamMemberRole,
  type SettingsResult,
} from '@/app/actions/settings';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button, Card, EmptyState, Input, Select, StatusBadge } from '@/components/kit';
import { StatusPill } from '@/app/(app)/_components/status-ui';
import { useResolvedT } from '@/hooks/useResolvedLocale';

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

function InviteForm() {
  const { t } = useResolvedT();
  const [show, setShow] = React.useState(false);
  // Handle the result in the submission handler (user-initiated) instead of
  // syncing via an effect.
  const [state, formAction, isPending] = useActionState<SettingsResult, FormData>(
    async (prev, formData) => {
      const result = await inviteTeamMember(prev, formData);
      if (result?.ok) {
        toast.success(t('t10misc.team.added'));
        setShow(false);
      } else if (result?.error) {
        toast.error(result.error);
      }
      return result;
    },
    {}
  );

  return (
    <div>
      {!show ? (
        <Button type="button" variant="primary" onClick={() => setShow(true)}>
          <UserPlus size={14} /> {t('t10misc.team.inviteMember')}
        </Button>
      ) : (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-ink mb-4">{t('t10misc.team.inviteTitle')}</h3>
          <form action={formAction} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t('t10misc.team.nameLabel')}
                name="name"
                type="text"
                required
                maxLength={100}
                placeholder={t('t10misc.team.namePlaceholder')}
              />
              <Input
                label={t('t10misc.team.emailLabel')}
                name="email"
                type="email"
                required
                maxLength={255}
                placeholder={t('t10misc.team.emailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t('t10misc.team.passwordLabel')}
                hint={t('t10misc.team.passwordHint')}
                name="password"
                type="password"
                required
                autoComplete="new-password"
              />
              <Select
                label={t('t10misc.team.roleLabel')}
                name="role"
                defaultValue="TECHNICIAN"
                options={[
                  { value: 'TECHNICIAN', label: t('t10misc.team.roleTechnician') },
                  { value: 'DISPATCHER', label: t('t10misc.team.roleDispatcher') },
                  { value: 'ADMIN', label: t('t10misc.team.roleAdmin') },
                ]}
              />
            </div>

            {state?.error && (
              <div role="alert" className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? t('t10misc.team.adding') : t('t10misc.team.addMember')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShow(false)}
              >
                {t('t10misc.team.cancel')}
              </Button>
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
  const [confirming, setConfirming] = React.useState<null | 'remove' | 'suspend' | 'unsuspend'>(null);
  const [error, setError] = React.useState<string | null>(null);
  const suspended = member.status === 'SUSPENDED';

  const runRemove = () => {
    setConfirming(null);
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

  const runSuspend = () => {
    setConfirming(null);
    startTransition(async () => {
      setError(null);
      const res = await suspendTeamMember(member.id);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(t('t10misc.team.suspendedToast'));
      }
    });
  };

  const runUnsuspend = () => {
    setConfirming(null);
    startTransition(async () => {
      setError(null);
      const res = await unsuspendTeamMember(member.id);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(t('t10misc.team.unsuspendedToast'));
      }
    });
  };

  const runRoleChange = (nextRole: string) => {
    if (nextRole === member.role) return;
    startTransition(async () => {
      setError(null);
      const res = await changeTeamMemberRole(member.id, nextRole);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(t('t10misc.team.roleChanged'));
      }
    });
  };

  const displayName = member.name || member.email;

  return (
    <div className="px-5 py-4 border-b border-line last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-surface-2 text-ink flex items-center justify-center shrink-0">
            {member.role === 'ADMIN' ? <ShieldCheck size={18} /> : <User size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink truncate">
              {displayName}
              {isSelf && <span className="ml-2 text-[10px] font-bold text-ink-2">{t('t10misc.team.you')}</span>}
            </p>
            <p className="text-xs text-ink-2 truncate">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={member.role} />
          {suspended && <StatusBadge tone="neutral">{t('t10misc.team.suspended')}</StatusBadge>}
          {!isSelf && !suspended && (
            <Button
              type="button"
              variant="ghost"
              sm
              onClick={() => setConfirming('suspend')}
              disabled={isPending}
            >
              {t('t10misc.team.suspend')}
            </Button>
          )}
          {!isSelf && suspended && (
            <Button
              type="button"
              variant="ghost"
              sm
              onClick={() => setConfirming('unsuspend')}
              disabled={isPending}
            >
              {t('t10misc.team.unsuspend')}
            </Button>
          )}
          {!isSelf && (
            <button
              onClick={() => setConfirming('remove')}
              disabled={isPending}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-ink-2 hover:text-danger p-2.5 rounded-lg hover:bg-danger-bg transition-colors"
              aria-label={t('t10misc.team.removeTitle').replace('{name}', displayName)}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      {!isSelf && !suspended && (
        <div className="mt-3 max-w-[240px]">
          <Select
            label={t('t10misc.team.roleLabel')}
            name={`role-${member.id}`}
            defaultValue={member.role}
            disabled={isPending}
            onChange={(e) => runRoleChange(e.target.value)}
            options={[
              { value: 'TECHNICIAN', label: t('t10misc.team.roleTechnician') },
              { value: 'DISPATCHER', label: t('t10misc.team.roleDispatcher') },
              { value: 'ADMIN', label: t('t10misc.team.roleAdmin') },
            ]}
          />
        </div>
      )}
      {error && (
        <p className="text-[11px] text-danger mt-2 font-medium" role="alert">{error}</p>
      )}
      <ConfirmDialog
        open={confirming === 'remove'}
        title={t('t10misc.team.removeTitle').replace('{name}', displayName)}
        message={t('t10misc.team.removeMessage')}
        confirmLabel={t('t10misc.team.removeConfirm')}
        cancelLabel={t('t10misc.team.keep')}
        busy={isPending}
        onConfirm={runRemove}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'suspend'}
        title={t('t10misc.team.suspendTitle').replace('{name}', displayName)}
        message={t('t10misc.team.suspendMessage')}
        confirmLabel={t('t10misc.team.suspendConfirm')}
        cancelLabel={t('t10misc.team.keep')}
        busy={isPending}
        onConfirm={runSuspend}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'unsuspend'}
        title={t('t10misc.team.unsuspendTitle').replace('{name}', displayName)}
        message={t('t10misc.team.unsuspendMessage')}
        confirmLabel={t('t10misc.team.unsuspendConfirm')}
        cancelLabel={t('t10misc.team.keep')}
        busy={isPending}
        onConfirm={runUnsuspend}
        onClose={() => setConfirming(null)}
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
            icon={<User />}
            title={t('t10misc.team.noMembersTitle')}
            text={t('t10misc.team.noMembersDesc')}
          />
        ) : (
          <div>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-ink-2 leading-relaxed">{t('t10misc.team.rolesHint')}</p>
    </div>
  );
}
