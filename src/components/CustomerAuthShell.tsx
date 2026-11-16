import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { LanguageToggle } from './LanguageToggle';
import { CustomerLogo } from './CustomerHeader';

/**
 * Dedicated auth shell for the customer login/signup pages: a minimal
 * header with the brand ONCE (logo + language toggle) and the page
 * content centred below. The customer layout renders no header above
 * this (see CustomerShell), so /customer/login and /customer/signup show
 * exactly one logo. Auth behaviour lives in the forms, not here.
 */
export default function CustomerAuthShell({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/directory" className="inline-flex items-center" aria-label="EveryJob">
          <CustomerLogo />
        </Link>
        <LanguageToggle current={locale} />
      </header>
      <main className="flex w-full flex-1 items-center justify-center px-4 pb-12">
        {children}
      </main>
    </div>
  );
}
