import { requireCustomerAuth } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import ConciergeClient from './concierge-client';

/**
 * "Get it done for me" — the customer concierge.
 * Describe → match (up to 3 verified pros) → preview → one-tap send.
 * Name/phone/city come from the customer's profile, editable in step 1.
 */
export default async function ConciergePage() {
  const session = await requireCustomerAuth();
  const locale = await getLocale();

  return (
    <ConciergeClient
      locale={locale}
      initialName={session.customer.name ?? ''}
      initialPhone={session.customer.phone ?? ''}
      initialCity={session.customer.city ?? ''}
    />
  );
}
