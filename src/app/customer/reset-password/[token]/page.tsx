import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import CustomerAuthShell from '@/components/CustomerAuthShell';
import CustomerResetPasswordForm from './form';

export default async function CustomerResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getCustomerSession();
  if (session) redirect('/customer');
  const locale = await getLocale();
  return (
    <CustomerAuthShell locale={locale}>
      <CustomerResetPasswordForm locale={locale} token={token} />
    </CustomerAuthShell>
  );
}
