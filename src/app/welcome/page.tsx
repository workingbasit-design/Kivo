import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { t, type Locale } from '@/lib/i18n';
import Logo from '@/components/Logo';
import WelcomeClient from '@/components/WelcomeClient';

export const metadata = { title: 'Welcome | EveryJob' };

/**
 * Post-Google-signup onboarding: ask new Google users for a Canadian
 * contact number. Skippable, and always editable later in Settings.
 * Shown only until the user saves or skips (User.phonePrompted).
 */
export default async function WelcomePage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (session.user.phonePrompted) redirect('/dashboard');

  const locale: Locale = await getLocale();

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <nav className="px-6 py-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg">
          <Logo size={32} />
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-xl shadow-zinc-200/50 p-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {t(locale, 'googleAuth.welcomeTitle')}
            </h1>
            <p className="text-sm text-zinc-500 mt-1 mb-6">
              {t(locale, 'googleAuth.welcomeSubtitle')}
            </p>
            <WelcomeClient locale={locale} userName={session.user.name} />
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-zinc-400 pb-6">Every job. One place.</p>
    </div>
  );
}
