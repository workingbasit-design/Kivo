import { requireAuth } from '@/lib/auth';
import NewCustomerForm from './customer-form';

/** Canada-only customer form. */
export default async function NewCustomerPage() {
  await requireAuth();

  return <NewCustomerForm />;
}
