import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { LocaleProvider } from '@/components/LanguageToggle';
import { getLocale } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already signed in (validated session) -> skip the auth pages. This uses
  // a real session check, unlike the old proxy cookie-presence redirect
  // which caused a redirect loop for stale cookies (2026-09-26).
  const session = await getSession();
  if (session?.user?.businessId) redirect('/dashboard');

  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="min-h-screen bg-paper flex flex-col">
        <nav className="px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg">
            <Logo size={32} />
          </Link>
        </nav>
        <div className="flex-1 flex items-center justify-center px-4 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="text-center text-xs text-zinc-400 pb-6">
          Every job. One place.
        </p>
      </div>
    </LocaleProvider>
  );
}
