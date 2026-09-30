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
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/customer" className="inline-flex items-center gap-2">
            <span className="bg-white rounded-lg p-1">
              <Logo size={22} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100 hidden sm:inline">
              For customers
            </span>
          </Link>
          {session && (
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-indigo-100">
                <Link href="/customer" className="hover:text-white transition-colors">Search</Link>
                <Link href="/customer/requests" className="hover:text-white transition-colors">Requests</Link>
                <Link href="/customer/saved" className="hover:text-white transition-colors">Saved</Link>
                <Link href="/customer/messages" className="hover:text-white transition-colors">Messages</Link>
                <Link href="/customer/profile" className="hover:text-white transition-colors">Profile</Link>
              </nav>
              <span className="text-sm font-medium text-white truncate max-w-[160px] bg-white/15 rounded-full px-3 py-1.5">
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
