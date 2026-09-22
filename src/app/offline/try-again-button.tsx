'use client';

import { RefreshCw } from 'lucide-react';

/** Client-only "try again" button for the offline fallback page. */
export default function TryAgainButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#6329d4] hover:bg-[#5223b3] text-white text-sm font-bold px-6 py-3 transition-colors"
    >
      <RefreshCw size={15} /> Try again
    </button>
  );
}
