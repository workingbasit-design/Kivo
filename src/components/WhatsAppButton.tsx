'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { waLink } from '@/lib/whatsapp';

/**
 * "Send via WhatsApp" button. Opens a wa.me deep link with the message
 * prefilled — the user taps it and sends from their own WhatsApp app.
 * EveryJob never sends anything automatically. Renders nothing without a phone.
 */
export default function WhatsAppButton({
  phone,
  message,
  regionCode,
  label = 'Send via WhatsApp',
  className,
}: {
  phone: string | null | undefined;
  message: string;
  regionCode?: string | null;
  label?: string;
  className?: string;
}) {
  const href = waLink(phone, message, regionCode);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border bg-[#25D366]/10 border-[#25D366]/30 text-[#128C4A] hover:bg-[#25D366]/20'
      }
      title="Opens WhatsApp with this message prefilled"
    >
      <MessageCircle size={13} />
      {label}
    </a>
  );
}
