import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { DesignShowcase } from '@/components/design/Showcase';

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

  return <DesignShowcase />;
}

export const metadata = {
  title: 'Design System — EveryJob',
  robots: 'noindex, nofollow',
};
