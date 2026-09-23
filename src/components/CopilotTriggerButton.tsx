"use client";

import React from 'react';
import { useResolvedT } from '@/hooks/useResolvedLocale';

type Props = {
  className?: string;
  children: React.ReactNode;
  /** Pre-filled message sent to the copilot when opened. Defaults to a localized greeting. */
  message?: string;
};

export default function CopilotTriggerButton({ className, children, message }: Props) {
  const { t } = useResolvedT();
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent('open-copilot', {
        detail: { message: message ?? t('t10misc.trigger.defaultMessage') },
      })
    );
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      type="button"
    >
      {children}
    </button>
  );
}
