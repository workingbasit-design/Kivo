'use client';

import { RefreshCw } from '@/components/icons';

/** Client-only "try again" button for the offline fallback page. */
export default function TryAgainButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-asphalt hover:bg-graphite text-hero-ink text-sm font-bold px-6 py-3 transition-colors"
    >
      <RefreshCw size={15} /> Try again
    </button>
  );
}
