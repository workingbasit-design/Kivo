import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import NewCustomerForm from './customer-form';

/** Canada-only customer form. */
export default async function NewCustomerPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');

  return <NewCustomerForm />;
}
