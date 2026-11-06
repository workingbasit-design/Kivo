"use client";

import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
  /** Accessible label for icon-only buttons (e.g. top-bar Copilot entry). */
  ariaLabel?: string;
  /** Pre-filled message sent to the copilot when opened. Defaults to a localized greeting. */
  message?: string;
};

export default function CopilotTriggerButton({ className, children, ariaLabel, message }: Props) {
  const handleClick = () => {
    // 2026-11-06: opening the copilot used to SEND the default greeting
    // ("Hi! How can I help today?") as a user message - it rendered in the
    // dark user bubble and the engine answered its own greeting (in FR with
    // an out-of-scope refusal). The widget already greets as the assistant
    // on open, so only send a message when one was explicitly passed.
    window.dispatchEvent(
      new CustomEvent('open-copilot', {
        detail: { message: message ?? null },
      })
    );
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      type="button"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
