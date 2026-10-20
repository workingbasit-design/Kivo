import { requireCustomerAuth } from '@/lib/customer-auth';
import { customerLogout } from '@/app/actions/customer-auth';
import { updateCustomerProfile } from '@/app/actions/customer-profile';
import { getAgentKeys } from '@/app/actions/customer-agent-keys';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Button, Card, Input } from '@/components/kit';
import { LogOut, Save } from '@/components/icons';
import AgentKeysSection from './agent-keys-client';

export default async function CustomerProfilePage() {
  const session = await requireCustomerAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);
  const customer = session.customer;
  const initial = (customer.name?.charAt(0) || customer.email.charAt(0)).toUpperCase();
  const agentKeys = await getAgentKeys();
  const keyStrings = {
    title: String(tr('agent.keys.title')),
    body: String(tr('agent.keys.body')),
    labelPlaceholder: String(tr('agent.keys.labelPlaceholder')),
    create: String(tr('agent.keys.create')),
    creating: String(tr('agent.keys.creating')),
    limitReached: String(tr('agent.keys.limitReached')),
    createdTitle: String(tr('agent.keys.createdTitle')),
    createdBody: String(tr('agent.keys.createdBody')),
    copy: String(tr('agent.keys.copy')),
    copied: String(tr('agent.keys.copied')),
    done: String(tr('agent.keys.done')),
    revoke: String(tr('agent.keys.revoke')),
    revokeConfirm: String(tr('agent.keys.revokeConfirm')),
    revoked: String(tr('agent.keys.revoked')),
    active: String(tr('agent.keys.active')),
    lastUsed: String(tr('agent.keys.lastUsed')),
    neverUsed: String(tr('agent.keys.neverUsed')),
    empty: String(tr('agent.keys.empty')),
  };

  return (
    <div className="space-y-5">
      <div className="ej-anim-fade-up">
        <h1 className="text-xl font-bold tracking-tight text-ink">{tr('customer.profile.title')}</h1>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '80ms' }}>
        <Card className="overflow-hidden">
          <div className="bg-asphalt px-5 pt-6 pb-8">
            <div className="flex items-center gap-4">
              <div className="ej-anim-scale-in w-16 h-16 rounded-2xl bg-surface/10 border border-hero-ink/15 flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-hero-ink">{initial}</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-hero-ink text-lg truncate">{customer.name}</p>
                <p className="text-hero-ink/60 text-xs truncate">{customer.email}</p>
              </div>
            </div>
          </div>

          <form action={updateCustomerProfile} className="p-5 space-y-4 -mt-2">
            <Input
              label={tr('customer.profile.fullName')}
              name="name"
              defaultValue={customer.name || ''}
              required
              maxLength={100}
            />
            <Input
              label={tr('customer.profile.email')}
              name="email"
              type="email"
              defaultValue={customer.email}
              disabled
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={tr('customer.profile.phone')}
                name="phone"
                type="tel"
                defaultValue={customer.phone || ''}
                maxLength={30}
                placeholder="(416) 555-0100"
              />
              <Input
                label={tr('customer.profile.city')}
                name="city"
                defaultValue={customer.city || ''}
                maxLength={100}
                placeholder="Toronto"
              />
            </div>
            <Button type="submit" block>
              <Save className="w-4 h-4" />
              {tr('customer.profile.saveChanges')}
            </Button>
          </form>
        </Card>
      </div>

      <AgentKeysSection keys={agentKeys} s={keyStrings} locale={locale} />

      <form action={customerLogout}>
        <Button type="submit" variant="danger" block>
          <LogOut className="w-4 h-4" />
          {tr('customer.profile.logOut')}
        </Button>
      </form>
    </div>
  );
}
