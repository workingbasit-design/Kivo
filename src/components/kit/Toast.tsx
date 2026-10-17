'use client';

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  visible: boolean;
}

/**
 * Fixed toast above the tab bar, mirroring the mockup's `.toast`.
 * Message plus an optional action button. Renders nothing while hidden.
 */
export function Toast({ message, actionLabel, onAction, visible }: ToastProps) {
  if (!visible) return null;
  return (
    <div
      data-kit="toast"
      role="status"
      className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] w-[min(448px,calc(100%-32px))] -translate-x-1/2 rounded-[14px] bg-toast-bg px-4 py-[13px] text-[15px] leading-[1.35] text-toast-ink shadow-kit-toast"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 min-w-0 flex-1">{message}</p>
        {actionLabel != null ? (
          <button
            type="button"
            onClick={onAction}
            className="min-h-[44px] flex-none px-1 font-bold text-toast-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
