import { getCustomerSession } from '@/lib/customer-auth';
import { getLocale } from '@/lib/i18n/server';
import CustomerShell from '@/components/CustomerShell';

/**
 * Customer area layout - mobile-first shell for homeowners.
 * The shell itself decides the chrome: auth pages (login/signup) get no
 * header or bottom nav (their brand appears once, inside
 * CustomerAuthShell); the home page gets the wide desktop shell; other
 * pages keep the narrow container. Login/signup pages handle their own
 * redirect when already logged in.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  const locale = await getLocale();
  return (
    <CustomerShell
      firstName={session?.customer.name?.split(' ')[0] ?? null}
      locale={locale}
    >
      {children}
    </CustomerShell>
  );
}
