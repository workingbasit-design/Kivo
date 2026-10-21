import Link from 'next/link';
import { ShieldOff } from '@/components/icons';
import { getLocale } from '@/lib/i18n/server';

/**
 * Branded 403 for the authenticated app ((app) segment).
 * Rendered when forbidden() is called - e.g. a technician opening
 * /reports or /reports/team, whose role lacks the SEE_PRICES
 * capability. Replaces the generic error page with a clear
 * "you don't have access" message inside the normal app shell,
 * and (with experimental.authInterrupts enabled in next.config.ts)
 * the response carries a real HTTP 403 status.
 */
export default async function AppForbidden() {
  const locale = await getLocale();
  const fr = locale === 'fr';
  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      <div className="rounded-3xl border border-smoke bg-surface p-8 text-center shadow-[0_16px_48px_-20px_rgba(0,0,0,0.15)]">
        <ShieldOff size={36} className="mx-auto text-ink-2 mb-3" aria-hidden />
        <h1 className="text-lg font-bold text-ink">
          {fr ? 'Accès refusé' : 'You don’t have access to this page'}
        </h1>
        <p className="text-sm text-graphite mt-2 leading-relaxed">
          {fr
            ? 'Votre rôle ne comprend pas l’accès à cette page. Si vous en avez besoin, demandez à un propriétaire ou à un administrateur de votre entreprise.'
            : 'Your role doesn’t include access to this page. If you need it, ask an owner or admin of your business to change your role.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center mt-5 bg-asphalt text-hero-ink px-6 py-2.5 rounded-full text-[15px] font-medium hover:bg-graphite transition active:scale-95"
        >
          {fr ? '← Tableau de bord' : '← Dashboard'}
        </Link>
      </div>
    </main>
  );
}
