import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import { safeNext } from '@/lib/redirect';
import CustomerAuthShell from '@/components/CustomerAuthShell';
import CustomerLoginForm from './form';

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const session = await getCustomerSession();
  if (session) redirect(dest ?? '/customer');
  const locale = await getLocale();
  return (
    <CustomerAuthShell locale={locale}>
      <CustomerLoginForm locale={locale} next={dest} />
    </CustomerAuthShell>
  );
}
