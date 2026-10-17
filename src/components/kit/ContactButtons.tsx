'use client';

import { cn } from '@/lib/utils';
import { Phone, MessageSquareText, Mail, Navigation } from '@/components/icons';

export interface ContactButtonsLabels {
  call: string;
  text: string;
  email: string;
  map: string;
}

export interface ContactButtonsProps {
  labels: ContactButtonsLabels;
  onCall: () => void;
  onText: () => void;
  onEmail: () => void;
  onMap: () => void;
}

const buttonClass = cn(
  'flex flex-col items-center justify-center gap-1',
  'min-h-[62px] min-w-[44px] rounded-[14px] bg-surface-2',
  'ring-1 ring-inset ring-line text-ink font-semibold text-[13px]',
  'cursor-pointer focus-visible:outline-2 focus-visible:outline-focus',
  'active:bg-surface',
);

/**
 * Four-button contact grid: Call, Text, Email, Map (mockup `.contact4`).
 */
export function ContactButtons({
  labels,
  onCall,
  onText,
  onEmail,
  onMap,
}: ContactButtonsProps) {
  const buttons = [
    { label: labels.call, onPress: onCall, Icon: Phone },
    { label: labels.text, onPress: onText, Icon: MessageSquareText },
    { label: labels.email, onPress: onEmail, Icon: Mail },
    { label: labels.map, onPress: onMap, Icon: Navigation },
  ];

  return (
    <div data-kit="contact-buttons" className="grid grid-cols-4 gap-2 py-0.5">
      {buttons.map(({ label, onPress, Icon }) => (
        <button
          key={label}
          type="button"
          onClick={onPress}
          className={buttonClass}
        >
          <Icon size={22} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
