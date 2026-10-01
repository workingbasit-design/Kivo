import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import CustomerSignupForm from './form';

export default async function CustomerSignupPage() {
  const session = await getCustomerSession();
  if (session) redirect('/customer');
  return <CustomerSignupForm />;
}
