import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import HeroBackdrop from '@/components/home/HeroBackdrop';
import { LocaleProvider, LanguageToggle } from '@/components/LanguageToggle';
import { getLocale } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { isDatabaseUnavailable } from '@/lib/db-errors';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Already signed in (validated session + ACTIVE membership) -> skip the
  // auth pages. This uses a real session check, unlike the old proxy
  // cookie-presence redirect which caused a redirect loop for stale
  // cookies (2026-09-26). We inline requireAuth()'s membership check here
  // because requireAuth() redirects anonymous visitors to /login - which
  // is this layout's own page, and that would loop.
  // If the database is unreachable we cannot validate anything: render the
  // login form anyway instead of crashing or bouncing to /dashboard (the
  // bounce was half of the /login <-> /dashboard refresh loop on outages).
  let authed = false;
  try {
    const session = await getSession();
    authed = session
      ? (await getActiveMembershipForUser(session.user.id)) !== null
      : false;
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
  }
  if (authed) redirect('/dashboard');

  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="relative min-h-screen bg-paper flex flex-col overflow-hidden">
        <div className="absolute inset-0 opacity-70">
          <HeroBackdrop />
        </div>
        <nav className="relative px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg">
            <Logo size={32} />
          </Link>
          <LanguageToggle current={locale} />
        </nav>
        <div className="relative flex-1 flex items-center justify-center px-4 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="relative text-center text-xs text-ink-2 pb-6">
          Every job. One place.
        </p>
      </div>
    </LocaleProvider>
  );
}
