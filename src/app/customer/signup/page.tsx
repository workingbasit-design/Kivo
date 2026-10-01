import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import CustomerSignupForm from './form';

export default async function CustomerSignupPage() {
  const session = await getCustomerSession();
  if (session) redirect('/customer');
  const locale = await getLocale();
  return <CustomerSignupForm locale={locale} />;
}
