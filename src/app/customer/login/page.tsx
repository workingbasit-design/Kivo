import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import CustomerLoginForm from './form';

export default async function CustomerLoginPage() {
  const session = await getCustomerSession();
  if (session) redirect('/customer');
  const locale = await getLocale();
  return <CustomerLoginForm locale={locale} />;
}
