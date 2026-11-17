'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import CustomerHeader, { type CustomerNavKey } from './CustomerHeader';
import CustomerBottomNav from './CustomerBottomNav';

/**
 * Customer area shell. Auth pages (login/signup) get NO chrome at all —
 * no sticky header, no bottom nav, no width constraint — because the auth
 * pages render their own single brand header inside CustomerAuthShell.
 * That is what fixes the double-logo defect: the brand appears once.
 *
 * The home page (pathname === '/customer') renders the exact reference
 * design full-bleed (Release 13): no .ej-main width cap or padding, so
 * the hero photo band reaches the viewport edges exactly like the public
 * homepage. The home content carries its own section widths, and
 * customer-home-signed-in.css adds the bottom clearance for the mobile
 * tab bar. Every other customer page keeps the existing narrow
 * mobile-first container.
 */
const AUTH_PATHS = ['/customer/login', '/customer/signup'];

function activeTab(pathname: string): CustomerNavKey {
  if (pathname === '/customer') return 'home';
  if (pathname.startsWith('/customer/requests')) return 'requests';
  if (pathname.startsWith('/customer/saved')) return 'saved';
  if (pathname.startsWith('/customer/messages')) return 'messages';
  if (pathname.startsWith('/customer/profile')) return 'profile';
  // Pages outside the nav (concierge, request detail, ...) light up
  // nothing instead of wrongly highlighting Home.
  return 'none';
}

export default function CustomerShell({
  firstName,
  locale,
  children,
}: {
  firstName?: string | null;
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';

  if (AUTH_PATHS.includes(pathname)) {
    return <div className="min-h-dvh bg-surface">{children}</div>;
  }

  const wide = pathname === '/customer';
  return (
    <div className="flex min-h-dvh flex-col bg-surface-2">
      <CustomerHeader active={activeTab(pathname)} firstName={firstName} locale={locale} />
      <main
        className={
          wide
            ? 'w-full flex-1'
            : 'mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4 md:max-w-2xl md:pb-8'
        }
      >
        {children}
      </main>
      <CustomerBottomNav locale={locale} />
    </div>
  );
}
