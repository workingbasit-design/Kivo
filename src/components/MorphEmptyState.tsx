'use client';

import { motion, AnimatePresence } from 'motion/react';
import { SearchX, WifiOff, Inbox, CalendarX } from '@/components/icons';

/**
 * MorphEmptyState - a single illustration that morphs between scenes.
 * The icon cross-fades and scales with spring physics when the variant changes,
 * so empty states feel alive instead of static.
 */
const ICONS = {
  'no-results': SearchX,
  offline: WifiOff,
  'inbox-zero': Inbox,
  'no-slots': CalendarX,
} as const;

export type EmptyVariant = keyof typeof ICONS;

export default function MorphEmptyState({
  variant,
  title,
  description,
  action,
}: {
  variant: EmptyVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const Icon = ICONS[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="relative w-20 h-20 mb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={variant}
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center"
          >
            <Icon size={32} className="text-ink-2" />
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={variant + title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-base font-bold text-ink mb-1">{title}</h3>
          {description && <p className="text-sm text-ink-2 max-w-[280px]">{description}</p>}
        </motion.div>
      </AnimatePresence>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
