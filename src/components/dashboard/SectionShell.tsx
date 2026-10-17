"use client";

/**
 * Part C (dashboard rebuild): per-section resilience. Each dashboard
 * section renders inside a SectionShell: a Suspense fallback (skeleton)
 * while loading, and this error boundary when its own fetch fails. Retry
 * remounts the section; the rest of the page keeps working.
 */
import React from "react";

export default function SectionShell({
  children,
  errorMessage,
  retryLabel,
}: {
  children: React.ReactNode;
  errorMessage: string;
  retryLabel: string;
}) {
  const [attempt, setAttempt] = React.useState(0);
  return (
    <SectionErrorBoundary
      key={attempt}
      onRetry={() => setAttempt((a) => a + 1)}
      errorMessage={errorMessage}
      retryLabel={retryLabel}
    >
      {children}
    </SectionErrorBoundary>
  );
}

class SectionErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    onRetry: () => void;
    errorMessage: string;
    retryLabel: string;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("[dashboard] section failed:", err);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-[20px] border border-zinc-200/70 bg-white p-5 text-center dark:bg-coal dark:border-white/10">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{this.props.errorMessage}</p>
          <button
            type="button"
            onClick={this.props.onRetry}
            className="mt-3 min-h-[44px] px-5 rounded-xl text-sm font-semibold text-asphalt underline underline-offset-2 dark:text-hivis"
          >
            {this.props.retryLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
