import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import CustomerLoginForm from './form';

/** Only allow relative in-app redirects (no protocol-relative or external). */
function safeNext(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return v.startsWith('/') && !v.startsWith('//') ? v : null;
}

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
  return <CustomerLoginForm locale={locale} next={dest} />;
}
