'use client';

import React, { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { smsLink } from '@/lib/sms';

/**
 * "Send via SMS" button. Opens the phone's native SMS app with the message
 * prefilled — the user taps it and sends from their own mobile plan.
 * EveryJob never sends anything automatically and this costs nothing.
 * Renders nothing without a phone number.
 */
export default function SmsButton({
  phone,
  message,
  regionCode,
  label = 'Send via SMS',
  className,
}: {
  phone: string | null | undefined;
  message: string;
  regionCode?: string | null;
  label?: string;
  className?: string;
}) {
  // iOS needs `sms:<n>&body=` while Android needs `sms:<n>?body=`.
  // Detect once on mount (SSR-safe: defaults to the Android shape).
  const [isIos] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
  const href = smsLink(phone, message, regionCode, isIos);
  if (!href) return null;
  return (
    <a
      href={href}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border bg-sky-500/10 border-sky-500/30 text-sky-700 hover:bg-sky-500/20'
      }
      title="Opens your SMS app with this message prefilled"
    >
      <MessageSquareText size={13} />
      {label}
    </a>
  );
}
