import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import Logo from '@/components/Logo';
import Link from 'next/link';

/**
 * Customer area layout — mobile-first shell for homeowners.
 * Redirects to login when no customer session exists.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  // login/signup pages handle their own redirect when already logged in
  return (
    <div className="min-h-dvh bg-zinc-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-zinc-200/70">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/customer" className="inline-flex items-center gap-2">
            <Logo />
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider hidden sm:inline">
              For customers
            </span>
          </Link>
          {session && (
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-zinc-600">
                <Link href="/customer" className="hover:text-indigo-600">Search</Link>
                <Link href="/customer/requests" className="hover:text-indigo-600">Requests</Link>
                <Link href="/customer/saved" className="hover:text-indigo-600">Saved</Link>
                <Link href="/customer/messages" className="hover:text-indigo-600">Messages</Link>
                <Link href="/customer/profile" className="hover:text-indigo-600">Profile</Link>
              </nav>
              <span className="text-sm text-zinc-600 truncate max-w-[160px]">
                Hi, {session.customer.name?.split(' ')[0] || 'there'}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-24 md:pb-8">{children}</main>

      <CustomerBottomNav />
    </div>
  );
}
