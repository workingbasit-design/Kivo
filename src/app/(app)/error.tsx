'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from '@/components/icons';

import { Button } from '@/components/kit';

/**
 * Error boundary for the signed-in app. Next.js renders this when any page
 * under (app) throws during server render or hydration - instead of the
 * generic black "This page couldn't load" page, the user gets a clear
 * explanation, a retry button, and the error digest for support.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest in the console for support/debugging; nothing
    // sensitive is rendered into the page itself.
    console.error('[everyjob] app segment error:', error.digest ?? '(no digest)', error.message);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-surface border border-line rounded-3xl p-8 md:p-10 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-warn-bg text-warn-text flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-xl font-bold text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-ink-2 leading-relaxed mb-6">
          This page couldn&apos;t load. Your data is safe - try again, and if it
          keeps happening, contact support with the code below.
        </p>
        <Button
          type="button"
          onClick={reset}
          variant="primary"
          className="rounded-full px-8"
        >
          <RotateCcw size={15} /> Try again
        </Button>
        {error.digest && (
          <p className="mt-5 text-[11px] font-mono text-ink-2">Error code: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
