import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CustomerNavKey = 'home' | 'directory' | 'requests' | 'saved' | 'messages' | 'profile' | 'none';

/**
 * The customer-facing brand mark from the approved 2026-11-16 mockup:
 * a lime tile with a dark "E" and the "EveryJob." wordmark. (The business
 * app keeps the existing dark-tile Logo; this variant is only for the
 * homeowner experience.)
 */
export function CustomerLogo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid shrink-0 place-items-center rounded-[10px] bg-hivis"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span
          className="font-extrabold leading-none text-hivis-ink"
          style={{ fontSize: size * 0.55 }}
        >
          E
        </span>
      </span>
      <span
        className="font-extrabold leading-none tracking-[-0.03em] text-ink"
        style={{ fontSize: size * 0.62 }}
      >
        EveryJob<span className="text-lime" aria-hidden="true">.</span>
      </span>
    </span>
  );
}

const TABS: { key: CustomerNavKey; href: string; labelKey: string }[] = [
  { key: 'home', href: '/customer', labelKey: 'customer.nav.home' },
  { key: 'directory', href: '/directory', labelKey: 'customer.nav.findPro' },
  { key: 'requests', href: '/customer/requests', labelKey: 'customer.nav.requests' },
  { key: 'saved', href: '/customer/saved', labelKey: 'customer.nav.saved' },
  { key: 'messages', href: '/customer/messages', labelKey: 'customer.nav.messages' },
];

/**
 * Shared customer header (mockup): logo, pill nav with the active tab on
 * lime, and a right-side slot — "Hi, {firstName}" + avatar when signed
 * in, Log in / Get started when signed out. The nav hides on mobile;
 * the bottom tab bar covers navigation there. No "For customers" label:
 * the header is the customer experience, it does not need to say so.
 */
export default function CustomerHeader({
  active,
  firstName,
  locale,
}: {
  active: CustomerNavKey;
  firstName?: string | null;
  locale: Locale;
}) {
  const tr = (path: string) => t(locale, path as never);
  return (
    <header className="ej-header">
      <div className="ej-header-in">
        <Link href="/customer" className="inline-flex shrink-0 items-center" aria-label="EveryJob">
          <CustomerLogo />
        </Link>

        <nav className="ej-header-nav hidden md:flex" aria-label={tr('customer.nav.search')}>
          {TABS.map(({ key, href, labelKey }) => (
            <Link
              key={key}
              href={href}
              aria-current={active === key ? 'page' : undefined}
              className={cn(
                'min-h-[44px] inline-flex items-center rounded-full px-3.5 text-sm font-semibold transition-colors',
                active === key
                  ? 'bg-hivis text-hivis-ink'
                  : 'text-ink-2 hover:text-ink'
              )}
            >
              {tr(labelKey)}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center gap-2">
          {firstName ? (
            <Link
              href="/customer/profile"
              className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full"
            >
              <span className="hidden text-sm text-ink-2 sm:block">
                {tr('customer.home.greeting').replace('{name}', firstName)}
              </span>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-sm font-bold text-ink"
                aria-hidden="true"
              >
                {firstName.charAt(0).toUpperCase()}
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/customer/login"
                className="inline-flex min-h-[44px] items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                {tr('t10misc.directory.logIn')}
              </Link>
              <Link
                href="/customer/signup"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-hivis px-4 text-sm font-bold text-hivis-ink transition-transform active:scale-[0.98]"
              >
                {tr('t10misc.directory.getStarted')}
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
