import Link from 'next/link';
import { WifiOff } from '@/components/icons';
import EveryJobLogo from '@/components/EveryJobLogo';
import TryAgainButton from './try-again-button';

export const metadata = {
  title: 'You are offline | EveryJob',
  description: 'EveryJob works offline - reconnect to sync your work.',
};

/**
 * Offline fallback page. The service worker serves this for navigations
 * when there is no connection and nothing newer is cached.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-paper font-sans flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto mb-5 w-fit">
          <EveryJobLogo size={52} />
        </div>
        <div className="bg-surface rounded-3xl border border-line/60 shadow-sm p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-6 h-6 text-warn-text" />
          </div>
          <h1 className="text-xl font-bold text-ink tracking-tight">You&apos;re offline</h1>
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">
            No connection right now. Anything you queued - new jobs, quotes -
            will sync automatically the moment you&apos;re back online.
          </p>
          <TryAgainButton />
          <div className="mt-4">
            <Link href="/dashboard" className="text-xs font-bold text-ink hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        </div>
        <p className="text-[11px] text-ink-2 mt-4">EveryJob works in low-signal areas - your work is safe.</p>
      </div>
    </div>
  );
}
