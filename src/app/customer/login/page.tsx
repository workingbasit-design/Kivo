import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import CustomerLoginForm from './form';

export default async function CustomerLoginPage() {
  const session = await getCustomerSession();
  if (session) redirect('/customer');
  return <CustomerLoginForm />;
}
