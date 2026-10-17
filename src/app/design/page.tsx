import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { Showcase } from '@/components/kit/Showcase';

/**
 * Internal component library showcase.
 * Available in development, or to ADMIN/OWNER in production.
 * Not linked from the app navigation.
 */
export default async function DesignPage() {
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    try {
      const { role } = await requireAuth();
      if (role !== 'ADMIN' && role !== 'OWNER') {
        notFound();
      }
    } catch {
      notFound();
    }
  }

  const locale = await getLocale();
  return <Showcase lang={locale === 'fr' ? 'fr' : 'en'} />;
}

export const metadata = {
  title: 'Design System — EveryJob',
  robots: 'noindex, nofollow',
};
